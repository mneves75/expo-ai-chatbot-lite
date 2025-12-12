import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";

export type Db = SQLite.SQLiteDatabase;
type SqlBindValue = string | number | null;
export type SqlStatement = {
  sql: string;
  params?: SqlBindValue[];
};

let db: Db | null = null;
let initPromise: Promise<void> | null = null;

const DB_SCHEMA_VERSION = 1;

const SQLITE_STARTUP_PRAGMAS: string[] = [
  // Concurrency + durability baseline (WAL enables concurrent readers during writes).
  "PRAGMA journal_mode = WAL;",
  "PRAGMA synchronous = NORMAL;",
  "PRAGMA foreign_keys = ON;",
  "PRAGMA busy_timeout = 5000;",
  "PRAGMA temp_store = MEMORY;",
  // Performance / file hygiene.
  "PRAGMA cache_size = -8000;", // KB
  "PRAGMA wal_autocheckpoint = 1000;", // ~4MB
  "PRAGMA journal_size_limit = 5242880;", // ~5MB
  // Safety.
  "PRAGMA trusted_schema = OFF;",
  // App signature to detect wrong database files.
  "PRAGMA application_id = 0x4C554D49;", // 'LUMI'
];

function getDb(): Db {
  if (!db) {
    // `openDatabaseSync` avoids async init races; we still run schema init via `initDb()`.
    db = SQLite.openDatabaseSync("lumina.db");
  }
  return db;
}

async function execPragmaBestEffort(database: Db, pragma: string): Promise<void> {
  try {
    await database.execAsync(pragma);
  } catch {
    // Some PRAGMAs can throw depending on platform/SQLite build; best-effort.
  }
}

export async function initDb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = getDb();

    for (const pragma of SQLITE_STARTUP_PRAGMAS) {
      // eslint-disable-next-line no-await-in-loop
      await execPragmaBestEffort(database, pragma);
    }

    await database.execAsync(
      `CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        lab_source TEXT NOT NULL,
        exam_date TEXT,
        abnormal_count INTEGER NOT NULL DEFAULT 0,
        normal_count INTEGER NOT NULL DEFAULT 0,
        needs_review INTEGER NOT NULL DEFAULT 0,
        encrypted_payload TEXT NOT NULL
      );`,
    );

    // Migration for older installs: add needs_review if missing.
    try {
      await database.execAsync(
        `ALTER TABLE reports ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;`,
      );
    } catch {
      // ignore if column already exists
    }

    await database.execAsync(
      `CREATE TABLE IF NOT EXISTS marker_index (
        report_id TEXT NOT NULL,
        marker_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        exam_date TEXT,
        flag TEXT NOT NULL,
        encrypted_payload TEXT NOT NULL,
        PRIMARY KEY (report_id, marker_id)
      );`,
    );

    await database.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_marker_index_marker_created_at ON marker_index(marker_id, created_at DESC);`,
    );

    await database.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);`,
    );

    // Schema versioning for forward-safe migrations. We keep this lightweight for now:
    // version bumps should be paired with explicit migration steps.
    try {
      const row = await database.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version;",
        [],
      );
      const currentVersion = row?.user_version ?? 0;
      if (currentVersion < DB_SCHEMA_VERSION) {
        await database.execAsync(`PRAGMA user_version = ${DB_SCHEMA_VERSION};`);
      }
    } catch {
      // Best-effort: lack of `user_version` should not block app startup.
    }
  })();

  return initPromise;
}

export async function execReadAll<T extends Record<string, any>>(
  sql: string,
  params: SqlBindValue[] = [],
): Promise<T[]> {
  return getDb().getAllAsync<T>(sql, params);
}

export async function execWrite(
  sql: string,
  params: SqlBindValue[] = [],
): Promise<void> {
  await getDb().runAsync(sql, params);
}

export async function execBatchWrite(statements: SqlStatement[]): Promise<void> {
  const database = getDb();
  const run = async (runner: Pick<Db, "runAsync">) => {
    for (const statement of statements) {
      // eslint-disable-next-line no-await-in-loop
      await runner.runAsync(statement.sql, statement.params ?? []);
    }
  };

  if (Platform.OS === "web") {
    // On web, expo-sqlite does not support exclusive transactions.
    // `withTransactionAsync` is still useful to reduce partial writes, but it isn't exclusive.
    await database.withTransactionAsync(async () => run(database));
    return;
  }

  await database.withExclusiveTransactionAsync(async (txn) => run(txn));
}

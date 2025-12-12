import * as SQLite from "expo-sqlite";

export type Db = SQLite.SQLiteDatabase;
export type SqlStatement = {
  sql: string;
  params?: (string | number | null)[];
};

let db: Db | null = null;
let initPromise: Promise<void> | null = null;

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
    db = SQLite.openDatabase("lumina.db");
  }
  return db;
}

function execSql<T = SQLite.SQLResultSetRowList>(
  database: Db,
  sql: string,
  params: (string | number | null)[] = [],
): Promise<SQLite.SQLResultSet> {
  return new Promise((resolve, reject) => {
    database.transaction(
      (tx) => {
        tx.executeSql(
          sql,
          params as any,
          (_tx, result) => resolve(result),
          (_tx, error) => {
            reject(error);
            return true;
          },
        );
      },
      (error) => reject(error),
    );
  });
}

export async function initDb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const database = getDb();

    for (const pragma of SQLITE_STARTUP_PRAGMAS) {
      try {
        // Some PRAGMAs can throw depending on platform/SQLite build; best-effort.
        // eslint-disable-next-line no-await-in-loop
        await execSql(database, pragma);
      } catch {
        // ignore
      }
    }

    await execSql(
      database,
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
      await execSql(
        database,
        `ALTER TABLE reports ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;`,
      );
    } catch {
      // ignore if column already exists
    }

    await execSql(
      database,
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

    await execSql(
      database,
      `CREATE INDEX IF NOT EXISTS idx_marker_index_marker_created_at ON marker_index(marker_id, created_at DESC);`,
    );

    await execSql(
      database,
      `CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);`,
    );
  })();

  return initPromise;
}

export async function execReadAll<T extends Record<string, any>>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T[]> {
  const database = getDb();
  const result = await execSql(database, sql, params);
  const rows: T[] = [];
  for (let i = 0; i < result.rows.length; i += 1) {
    rows.push(result.rows.item(i));
  }
  return rows;
}

export async function execWrite(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<void> {
  const database = getDb();
  await execSql(database, sql, params);
}

export async function execBatchWrite(statements: SqlStatement[]): Promise<void> {
  const database = getDb();

  await new Promise<void>((resolve, reject) => {
    database.transaction(
      (tx) => {
        for (const statement of statements) {
          tx.executeSql(
            statement.sql,
            (statement.params ?? []) as any,
            undefined,
            (_tx, error) => {
              reject(error);
              return true;
            },
          );
        }
      },
      (error) => reject(error),
      () => resolve(),
    );
  });
}

import { describe, expect, it, mock } from "bun:test";

type SqlBindValue = string | number | null;

type FakeRunResult = {
  changes: number;
  lastInsertRowId: number;
};

type SqlCall =
  | { kind: "openDatabaseSync"; databaseName: string }
  | { kind: "execAsync"; sql: string }
  | { kind: "runAsync"; sql: string; params: SqlBindValue[] }
  | { kind: "getAllAsync"; sql: string; params: SqlBindValue[] }
  | { kind: "withTransactionAsync" }
  | { kind: "withExclusiveTransactionAsync" }
  | { kind: "txn.runAsync"; sql: string; params: SqlBindValue[] };

function createFakeDb(calls: SqlCall[]) {
  const runResult: FakeRunResult = { changes: 0, lastInsertRowId: 0 };

  const txn = {
    runAsync: async (sql: string, params: SqlBindValue[] = []) => {
      calls.push({ kind: "txn.runAsync", sql, params });
      return runResult;
    },
  };

  const db = {
    execAsync: async (sql: string) => {
      calls.push({ kind: "execAsync", sql });
    },
    runAsync: async (sql: string, params: SqlBindValue[] = []) => {
      calls.push({ kind: "runAsync", sql, params });
      return runResult;
    },
    getAllAsync: async <T>(sql: string, params: SqlBindValue[] = []) => {
      calls.push({ kind: "getAllAsync", sql, params });
      return [] as T[];
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      calls.push({ kind: "withTransactionAsync" });
      await task();
    },
    withExclusiveTransactionAsync: async (task: (t: typeof txn) => Promise<void>) => {
      calls.push({ kind: "withExclusiveTransactionAsync" });
      await task(txn);
    },
  };

  return { db };
}

let importSerial = 0;

async function importDbModuleForPlatform(os: string, calls: SqlCall[]) {
  // Ensure module mocks from previous tests don't leak into the next import.
  mock.restore();

  mock.module("react-native", () => ({ Platform: { OS: os } }));

  const { db } = createFakeDb(calls);
  mock.module("expo-sqlite", () => ({
    openDatabaseSync: (databaseName: string) => {
      calls.push({ kind: "openDatabaseSync", databaseName });
      return db;
    },
  }));

  // Querystring forces a fresh module instance per test (avoids shared module state).
  importSerial += 1;
  return await import(
    `./db?platform=${encodeURIComponent(os)}&run=${importSerial}`,
  );
}

describe("db.ts wrapper (unit)", () => {
  it("initDb opens lumina.db and executes schema + PRAGMAs", async () => {
    const calls: SqlCall[] = [];
    const { initDb } = await importDbModuleForPlatform("ios", calls);

    await initDb();

    expect(calls[0]).toEqual({ kind: "openDatabaseSync", databaseName: "lumina.db" });

    const execSqls = calls
      .filter((c): c is Extract<SqlCall, { kind: "execAsync" }> => c.kind === "execAsync")
      .map((c) => c.sql);

    // PRAGMA baseline should be applied before schema.
    expect(execSqls.some((s) => s.includes("PRAGMA journal_mode = WAL"))).toBe(true);
    expect(execSqls.some((s) => s.includes("CREATE TABLE IF NOT EXISTS reports"))).toBe(true);
    expect(execSqls.some((s) => s.includes("CREATE TABLE IF NOT EXISTS marker_index"))).toBe(true);
  });

  it("execReadAll delegates to getAllAsync with params", async () => {
    const calls: SqlCall[] = [];
    const { execReadAll } = await importDbModuleForPlatform("ios", calls);

    await execReadAll<{ a: number }>("SELECT 1 as a WHERE ? IS NULL", [null]);

    expect(
      calls.some(
        (c) =>
          c.kind === "getAllAsync" &&
          c.sql.includes("SELECT 1") &&
          c.params.length === 1 &&
          c.params[0] === null,
      ),
    ).toBe(true);
  });

  it("execWrite delegates to runAsync with params", async () => {
    const calls: SqlCall[] = [];
    const { execWrite } = await importDbModuleForPlatform("ios", calls);

    await execWrite("DELETE FROM reports WHERE id = ?", ["abc"]);

    expect(
      calls.some(
        (c) =>
          c.kind === "runAsync" &&
          c.sql.includes("DELETE FROM reports") &&
          c.params.length === 1 &&
          c.params[0] === "abc",
      ),
    ).toBe(true);
  });

  it("execBatchWrite uses exclusive transaction on native platforms", async () => {
    const calls: SqlCall[] = [];
    const { execBatchWrite } = await importDbModuleForPlatform("ios", calls);

    await execBatchWrite([
      { sql: "INSERT INTO reports (id, created_at, lab_source, encrypted_payload) VALUES (?, ?, ?, ?)", params: ["1", "now", "sabin", "{}"] },
      { sql: "DELETE FROM marker_index WHERE report_id = ?", params: ["1"] },
    ]);

    expect(calls.some((c) => c.kind === "withExclusiveTransactionAsync")).toBe(true);
    // Statements should run on the transaction runner, not the base DB runner.
    expect(calls.some((c) => c.kind === "txn.runAsync")).toBe(true);
  });

  it("execBatchWrite uses non-exclusive transaction on web", async () => {
    const calls: SqlCall[] = [];
    const { execBatchWrite } = await importDbModuleForPlatform("web", calls);

    await execBatchWrite([{ sql: "DELETE FROM reports", params: [] }]);

    expect(calls.some((c) => c.kind === "withTransactionAsync")).toBe(true);
    expect(calls.some((c) => c.kind === "withExclusiveTransactionAsync")).toBe(false);
  });
});

import { afterEach, describe, expect, it, mock } from "bun:test";

type SqlStatement = { sql: string; params?: Array<string | number | null> };

let importSerial = 0;

async function importReportsModule(calls: { batch?: SqlStatement[] }[]) {
  mock.restore();

  mock.module("@/lib/db/db", () => ({
    execBatchWrite: async (statements: SqlStatement[]) => {
      calls.push({ batch: statements });
    },
    execReadAll: async () => {
      throw new Error("execReadAll not expected in this test");
    },
  }));

  importSerial += 1;
  return await import(`./reports?run=${importSerial}`);
}

describe("deleteAllReports", () => {
  afterEach(() => {
    // Ensure module mocks do not leak into unrelated tests.
    mock.restore();
  });

  it("deletes marker_index and reports in one batch", async () => {
    const calls: { batch?: SqlStatement[] }[] = [];
    const { deleteAllReports } = await importReportsModule(calls);

    await deleteAllReports();

    expect(calls.length).toBe(1);
    expect(calls[0]?.batch?.map((s) => s.sql)).toEqual([
      "DELETE FROM marker_index;",
      "DELETE FROM reports;",
    ]);
  });
});

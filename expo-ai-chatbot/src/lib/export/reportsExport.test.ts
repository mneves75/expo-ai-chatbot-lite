import { buildReportsExportFile } from "@/lib/export/reportsExport";
import type { ReportPayload } from "@/lib/sabin/types";

test("buildReportsExportFile shapes export bundle", () => {
  const payload: ReportPayload = {
    v: 1,
    source: { lab: "sabin", importedAt: "2025-12-12T00:00:00.000Z" },
    rawText: "SABIN ...",
    analysis: {
      summary: { mainFindings: "ok", abnormalCount: 0, normalCount: 1 },
      results: [
        {
          id: "GLICOSE",
          examName: "Glicose",
          resultValue: 90,
          unit: "mg/dL",
          flag: "normal",
          confidence: 1,
        },
      ],
    },
  };

  const out = buildReportsExportFile(
    [{ id: "r1", createdAt: "2025-12-12T01:00:00.000Z", payload }],
    "2025-12-12T02:00:00.000Z",
  );

  expect(out.v).toBe(1);
  expect(out.exportedAt).toBe("2025-12-12T02:00:00.000Z");
  expect(out.reports).toHaveLength(1);
  expect(out.reports[0]?.payload?.analysis?.results?.[0]?.id).toBe("GLICOSE");
});


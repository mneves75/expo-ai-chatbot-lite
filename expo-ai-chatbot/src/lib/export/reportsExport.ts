import type { ReportPayload } from "@/lib/sabin/types";

export type ExportedReport = {
  id: string;
  createdAt: string;
  payload: ReportPayload;
};

export type ReportsExportFileV1 = {
  v: 1;
  exportedAt: string;
  reports: ExportedReport[];
};

export function buildReportsExportFile(
  reports: ExportedReport[],
  exportedAt = new Date().toISOString(),
): ReportsExportFileV1 {
  return {
    v: 1,
    exportedAt,
    reports,
  };
}


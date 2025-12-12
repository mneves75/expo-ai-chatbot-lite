import { generateUUID } from "@/lib/utils";
import { decryptJson, encryptJson } from "@/lib/crypto/encryptedJson";
import type { EncryptedBlobV1 } from "@/lib/crypto/types";
import { execBatchWrite, execReadAll } from "@/lib/db/db";
import type { ReportPayload } from "@/lib/sabin/types";
import { needsReviewFromAnalysis } from "@/lib/sabin/confidence";
import { encryptMarkerIndexPayloadFromResult } from "@/lib/db/markerIndexPayload";

export type ReportRow = {
  id: string;
  created_at: string;
  lab_source: string;
  exam_date: string | null;
  abnormal_count: number;
  normal_count: number;
  needs_review: number;
};

type ReportRowWithPayload = ReportRow & { encrypted_payload: string };

export async function listReports(): Promise<ReportRow[]> {
  return execReadAll<ReportRow>(
    `SELECT id, created_at, lab_source, exam_date, abnormal_count, normal_count, needs_review
     FROM reports
     ORDER BY created_at DESC;`,
  );
}

export async function getReportPayloadById(id: string): Promise<ReportPayload> {
  const rows = await execReadAll<ReportRowWithPayload>(
    `SELECT id, created_at, lab_source, exam_date, abnormal_count, normal_count, needs_review, encrypted_payload
     FROM reports
     WHERE id = ? LIMIT 1;`,
    [id],
  );

  const row = rows[0];
  if (!row) throw new Error("Report not found");

  const blob = JSON.parse(row.encrypted_payload) as EncryptedBlobV1;
  return decryptJson<ReportPayload>(blob);
}

export async function insertReport(payload: ReportPayload): Promise<string> {
  const id = generateUUID();
  const encrypted = await encryptJson(payload);

  const examDate = payload.analysis.summary.examDate ?? null;
  const needsReview = needsReviewFromAnalysis(payload.analysis) ? 1 : 0;

  const statements = [
    {
      sql: `INSERT INTO reports (id, created_at, lab_source, exam_date, abnormal_count, normal_count, needs_review, encrypted_payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      params: [
        id,
        payload.source.importedAt,
        payload.source.lab,
        examDate,
        payload.analysis.summary.abnormalCount,
        payload.analysis.summary.normalCount,
        needsReview,
        JSON.stringify(encrypted),
      ],
    },
  ];

  for (const result of payload.analysis.results) {
    // eslint-disable-next-line no-await-in-loop
    const markerBlob = await encryptMarkerIndexPayloadFromResult(result);
    statements.push({
      sql: `INSERT OR REPLACE INTO marker_index (report_id, marker_id, created_at, exam_date, flag, encrypted_payload)
            VALUES (?, ?, ?, ?, ?, ?);`,
      params: [
        id,
        result.id,
        payload.source.importedAt,
        examDate,
        result.flag,
        JSON.stringify(markerBlob),
      ],
    });
  }

  await execBatchWrite(statements);

  return id;
}

export async function deleteAllReports(): Promise<void> {
  // Delete in a single batch for atomicity (avoid partial deletes if the app is killed mid-operation).
  await execBatchWrite([
    { sql: "DELETE FROM marker_index;" },
    { sql: "DELETE FROM reports;" },
  ]);
}

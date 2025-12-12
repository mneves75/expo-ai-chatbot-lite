import type { EncryptedBlobV1 } from "@/lib/crypto/types";
import { decryptJson } from "@/lib/crypto/encryptedJson";
import { execReadAll } from "@/lib/db/db";
import type { Flag } from "@/lib/sabin/types";
import type { MarkerIndexPayload } from "@/lib/db/markerIndexPayload";

export type MarkerIndexRow = {
  report_id: string;
  marker_id: string;
  created_at: string;
  exam_date: string | null;
  flag: string;
  encrypted_payload: string;
};

export type LatestMarker = {
  markerId: string;
  examDate: string | null;
  flag: Flag;
  payload: MarkerIndexPayload;
};

export type MarkerHistoryItem = {
  reportId: string;
  markerId: string;
  createdAt: string;
  examDate: string | null;
  flag: Flag;
  payload: MarkerIndexPayload;
};

export async function getLatestMarker(markerId: string): Promise<LatestMarker | null> {
  const rows = await execReadAll<MarkerIndexRow>(
    `SELECT report_id, marker_id, created_at, exam_date, flag, encrypted_payload
     FROM marker_index
     WHERE marker_id = ?
     ORDER BY created_at DESC
     LIMIT 1;`,
    [markerId],
  );

  const row = rows[0];
  if (!row) return null;

  const blob = JSON.parse(row.encrypted_payload) as EncryptedBlobV1;
  const payload = await decryptJson<MarkerIndexPayload>(blob);

  return {
    markerId: row.marker_id,
    examDate: row.exam_date,
    flag: row.flag as Flag,
    payload,
  };
}

export async function getLatestMarkers(markerIds: string[]): Promise<LatestMarker[]> {
  const out: LatestMarker[] = [];
  for (const markerId of markerIds) {
    // eslint-disable-next-line no-await-in-loop
    const latest = await getLatestMarker(markerId);
    if (latest) out.push(latest);
  }
  return out;
}

export async function listMarkerHistory(
  markerId: string,
  limit = 20,
): Promise<MarkerHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(200, limit));

  const rows = await execReadAll<MarkerIndexRow>(
    `SELECT report_id, marker_id, created_at, exam_date, flag, encrypted_payload
     FROM marker_index
     WHERE marker_id = ?
     ORDER BY created_at DESC
     LIMIT ${safeLimit};`,
    [markerId],
  );

  const out: MarkerHistoryItem[] = [];
  for (const row of rows) {
    const blob = JSON.parse(row.encrypted_payload) as EncryptedBlobV1;
    // eslint-disable-next-line no-await-in-loop
    const payload = await decryptJson<MarkerIndexPayload>(blob);

    out.push({
      reportId: row.report_id,
      markerId: row.marker_id,
      createdAt: row.created_at,
      examDate: row.exam_date,
      flag: row.flag as Flag,
      payload,
    });
  }

  return out;
}

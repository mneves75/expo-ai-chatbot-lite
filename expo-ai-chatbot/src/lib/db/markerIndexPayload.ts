import { encryptJson } from "@/lib/crypto/encryptedJson";
import type { EncryptedBlobV1 } from "@/lib/crypto/types";
import type { LabResult } from "@/lib/sabin/types";

export type MarkerIndexPayload = {
  resultValue?: number;
  resultText?: string;
  unit?: string;
  referenceRange?: string;
};

export function buildMarkerIndexPayloadFromResult(result: LabResult): MarkerIndexPayload {
  return {
    resultValue: result.resultValue,
    resultText: result.resultText,
    unit: result.unit,
    referenceRange: result.referenceRange,
  };
}

export async function encryptMarkerIndexPayloadFromResult(
  result: LabResult,
  keyBytes?: Uint8Array,
): Promise<EncryptedBlobV1> {
  return encryptJson(buildMarkerIndexPayloadFromResult(result), keyBytes);
}


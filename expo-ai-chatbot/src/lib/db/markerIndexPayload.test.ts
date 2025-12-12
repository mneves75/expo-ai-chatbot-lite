import { decryptJson } from "@/lib/crypto/encryptedJson";
import { encryptMarkerIndexPayloadFromResult } from "@/lib/db/markerIndexPayload";
import type { LabResult } from "@/lib/sabin/types";

test("encryptMarkerIndexPayloadFromResult encrypts and decrypts with a provided key", async () => {
  const key = new Uint8Array(32).fill(3);

  const result: LabResult = {
    id: "GLICOSE",
    examName: "Glicose",
    resultValue: 95,
    unit: "mg/dL",
    referenceRange: "70 a 99",
    flag: "normal",
    confidence: 1,
  };

  const blob = await encryptMarkerIndexPayloadFromResult(result, key);
  const payload = await decryptJson<any>(blob, key);

  expect(payload.resultValue).toBe(95);
  expect(payload.unit).toBe("mg/dL");
  expect(payload.referenceRange).toMatch(/70/);
});


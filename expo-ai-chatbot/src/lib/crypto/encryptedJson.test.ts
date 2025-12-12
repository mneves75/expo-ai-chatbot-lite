import { decryptJson, encryptJson } from "@/lib/crypto/encryptedJson";
import { base64ToBytes, bytesToBase64 } from "@/lib/encoding/base64";

test("encryptJson/decryptJson round-trip", async () => {
  const key = new Uint8Array(32).fill(7);
  const payload = { hello: "world", n: 123, nested: { ok: true } };

  const blob = await encryptJson(payload, key);
  const out = await decryptJson<typeof payload>(blob, key);

  expect(out).toEqual(payload);
});

test("decryptJson fails on tampering", async () => {
  const key = new Uint8Array(32).fill(9);
  const payload = { secret: "data" };

  const blob = await encryptJson(payload, key);

  const bytes = base64ToBytes(blob.ciphertextB64);
  bytes[0] = (bytes[0] ?? 0) ^ 0xff;

  try {
    await decryptJson({ ...blob, ciphertextB64: bytesToBase64(bytes) }, key);
    throw new Error("Expected decryption to fail, but it succeeded");
  } catch (e: any) {
    expect(String(e?.message ?? e)).toMatch(/authentication/i);
  }
});

import { AES } from "@stablelib/aes";
import { GCM } from "@stablelib/gcm";
import { encode as utf8Encode, decode as utf8Decode } from "@stablelib/utf8";
import { base64ToBytes, bytesToBase64 } from "@/lib/encoding/base64";
import type { EncryptedBlobV1 } from "@/lib/crypto/types";
import { randomBytes } from "@/lib/crypto/random";

async function resolveKeyBytes(keyBytes?: Uint8Array): Promise<Uint8Array> {
  if (keyBytes) return keyBytes;

  // Lazy import so unit tests can run outside the Expo runtime.
  const mod = await import("@/lib/crypto/masterKey");
  return mod.getOrCreateMasterKey();
}

export async function encryptJson(
  payload: unknown,
  keyBytes?: Uint8Array,
): Promise<EncryptedBlobV1> {
  const key = await resolveKeyBytes(keyBytes);
  const nonce = await randomBytes(12); // AES-GCM standard nonce size

  const plaintext = utf8Encode(JSON.stringify(payload));
  const aes = new AES(key);
  const gcm = new GCM(aes);
  const ciphertext = gcm.seal(nonce, plaintext);

  return {
    v: 1,
    nonceB64: bytesToBase64(nonce),
    ciphertextB64: bytesToBase64(ciphertext),
  };
}

export async function decryptJson<T>(
  blob: EncryptedBlobV1,
  keyBytes?: Uint8Array,
): Promise<T> {
  if (blob.v !== 1) {
    throw new Error(`Unsupported encrypted blob version: ${String(blob.v)}`);
  }

  const key = await resolveKeyBytes(keyBytes);
  const nonce = base64ToBytes(blob.nonceB64);
  const ciphertext = base64ToBytes(blob.ciphertextB64);

  const aes = new AES(key);
  const gcm = new GCM(aes);
  const plaintext = gcm.open(nonce, ciphertext);
  if (!plaintext) {
    throw new Error("Decryption failed (authentication error)");
  }

  return JSON.parse(utf8Decode(plaintext)) as T;
}

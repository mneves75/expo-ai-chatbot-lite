import { decode as base64Decode, encode as base64Encode } from "@stablelib/base64";

export function bytesToBase64(bytes: Uint8Array): string {
  return base64Encode(bytes);
}

export function base64ToBytes(base64: string): Uint8Array {
  return base64Decode(base64);
}


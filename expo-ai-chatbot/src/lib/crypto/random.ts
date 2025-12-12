export async function randomBytes(length: number): Promise<Uint8Array> {
  const isReactNative =
    typeof navigator !== "undefined" &&
    (navigator as any)?.product === "ReactNative";

  const out = new Uint8Array(length);
  const cryptoObj: any = (globalThis as any).crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(out);
    return out;
  }

  // React Native does not ship Node.js built-ins (no `crypto` module), and Metro will
  // fail builds if we reference them. `expo-crypto` is the supported on-device RNG.
  //
  // We still use this as a fallback for non-RN environments where `crypto.getRandomValues`
  // is not available (e.g., some JS runtimes).
  const ExpoCrypto = await import("expo-crypto");
  const bytes = await ExpoCrypto.getRandomBytesAsync(length);
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as any);
}

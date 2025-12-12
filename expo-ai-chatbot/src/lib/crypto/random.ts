export async function randomBytes(length: number): Promise<Uint8Array> {
  const isReactNative =
    typeof navigator !== "undefined" &&
    (navigator as any)?.product === "ReactNative";

  if (!isReactNative) {
    const out = new Uint8Array(length);
    const cryptoObj: any = (globalThis as any).crypto;
    if (cryptoObj?.getRandomValues) {
      cryptoObj.getRandomValues(out);
      return out;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require("crypto") as typeof import("crypto");
    return new Uint8Array(nodeCrypto.randomBytes(length));
  }

  const ExpoCrypto = await import("expo-crypto");
  const bytes = await ExpoCrypto.getRandomBytesAsync(length);
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as any);
}

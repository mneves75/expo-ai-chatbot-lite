import { describe, expect, it } from "bun:test";
import { randomBytes } from "@/lib/crypto/random";

describe("randomBytes", () => {
  it("returns the requested length", async () => {
    const bytes = await randomBytes(32);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });

  it("does not return all-zero bytes (sanity)", async () => {
    const bytes = await randomBytes(32);
    // The probability of 32 random bytes all being zero is ~1 / 2^256; if this fails,
    // the RNG is almost certainly broken.
    const anyNonZero = bytes.some((b) => b !== 0);
    expect(anyNonZero).toBe(true);
  });
});


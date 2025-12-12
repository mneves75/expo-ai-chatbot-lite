import { describe, expect, it } from "bun:test";
import { normalizeWhitespace } from "@/lib/sabin/textUtils";

describe("normalizeWhitespace", () => {
  it("de-hyphenates split words across line breaks", () => {
    expect(normalizeWhitespace("pa-\nra")).toBe("para");
  });

  it("de-hyphenates split words with PDF spacing artifacts", () => {
    expect(normalizeWhitespace("pa- ra")).toBe("para");
  });

  it("removes soft hyphen and normalizes NBSP", () => {
    expect(normalizeWhitespace(`a\u00ADb\u00A0c`)).toBe("ab c");
  });
});


import { describe, expect, it } from "bun:test";
import { isLuminaTempFileName } from "@/lib/fs/luminaCacheWipe";

describe("isLuminaTempFileName", () => {
  it("matches export files", () => {
    expect(isLuminaTempFileName("lumina-export-2025-12-12.json")).toBe(true);
    expect(isLuminaTempFileName("lumina-export-2025-12-12.JSON")).toBe(true);
  });

  it("matches rendered pdf pages (best-effort)", () => {
    expect(isLuminaTempFileName("lumina-pdf-page-1.png")).toBe(true);
    expect(isLuminaTempFileName("lumina-pdf-page-abc123.jpeg")).toBe(true);
  });

  it("does not match unrelated files", () => {
    expect(isLuminaTempFileName("DocumentPicker/foo.pdf")).toBe(false);
    expect(isLuminaTempFileName("random.json")).toBe(false);
    expect(isLuminaTempFileName("lumina-export-2025-12-12.txt")).toBe(false);
    expect(isLuminaTempFileName("lumina-export-2025-12-12")).toBe(false);
  });
});


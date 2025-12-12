import { describe, expect, it } from "bun:test";
import { shouldDeleteCacheFileUri } from "@/lib/fs/cacheCleanup";

describe("shouldDeleteCacheFileUri", () => {
  it("returns true when uri is under cacheDirectory", () => {
    expect(
      shouldDeleteCacheFileUri(
        "file:///var/mobile/Containers/Data/Application/ABC/Library/Caches/DocumentPicker/test.pdf",
        "file:///var/mobile/Containers/Data/Application/ABC/Library/Caches/",
      ),
    ).toBe(true);
  });

  it("returns false when uri is not under cacheDirectory", () => {
    expect(
      shouldDeleteCacheFileUri(
        "file:///var/mobile/Containers/Data/Application/ABC/Documents/test.pdf",
        "file:///var/mobile/Containers/Data/Application/ABC/Library/Caches/",
      ),
    ).toBe(false);
  });

  it("returns false without cacheDirectory", () => {
    expect(
      shouldDeleteCacheFileUri("file:///anywhere/test.pdf", null),
    ).toBe(false);
  });
});


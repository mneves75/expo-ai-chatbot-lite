import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function* walkFiles(rootDir: string): Generator<string> {
  const entries = readdirSync(rootDir);
  for (const entry of entries) {
    const fullPath = join(rootDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      yield* walkFiles(fullPath);
      continue;
    }
    yield fullPath;
  }
}

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

describe("offline-only guardrails", () => {
  it("does not include obvious network client usage in shipped source", () => {
    const forbidden = [
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\s*\(/,
      /\bEventSource\s*\(/,
      /\bnavigator\.sendBeacon\b/,
      /\bexpo-network\b/,
    ];

    const sourceRoot = join(import.meta.dir, ".."); // src/lib/policy -> src/lib
    const srcRoot = join(sourceRoot, ".."); // -> src

    const offenders: Array<{ file: string; pattern: string }> = [];

    for (const filePath of walkFiles(srcRoot)) {
      if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) continue;
      if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) continue;
      const content = readText(filePath);
      for (const pattern of forbidden) {
        if (pattern.test(content)) {
          offenders.push({ file: filePath, pattern: String(pattern) });
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});


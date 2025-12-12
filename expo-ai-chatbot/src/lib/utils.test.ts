import { describe, expect, it } from "bun:test";
import { generateUUID } from "@/lib/utils";

describe("generateUUID", () => {
  it("returns a v4 UUID string", () => {
    const id = generateUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("does not collide across a reasonable sample", () => {
    const count = 500;
    const ids = new Set<string>();
    for (let i = 0; i < count; i += 1) {
      ids.add(generateUUID());
    }
    expect(ids.size).toBe(count);
  });
});


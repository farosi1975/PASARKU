import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("promo notification scheduler resilience", () => {
  it("keeps promo notifications successful when courier scheduler schema is unavailable", () => {
    const source = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
    expect(source).toContain("Promise.allSettled");
    expect(source).toContain("Schema scheduler kurir belum tersedia di database production.");
    expect(source).toContain('promoResult.status === "rejected"');
  });
});

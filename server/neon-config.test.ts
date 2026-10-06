import { describe, expect, it } from "vitest";

describe("Neon PostgreSQL configuration", () => {
  it("uses a PostgreSQL DATABASE_URL when provided", () => {
    const url = process.env.NEON_DATABASE_URL ?? (process.env.DATABASE_URL?.startsWith("postgres") ? process.env.DATABASE_URL : undefined);
    if (!url) return;
    expect(url).toMatch(/^postgres(?:ql)?:\/\//);
  });
});

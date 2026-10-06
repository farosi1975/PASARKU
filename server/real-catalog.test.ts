import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("real seller catalog", () => {
  it("Home uses only the server catalog and shows an empty state when none is available", () => {
    const home = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    expect(home).not.toContain('import { categories, formatRupiah, products');
    expect(home).toContain("syncedProducts.data");
    expect(home).toContain("Belum ada toko yang buka");
    expect(home).toContain("produk nyata");
  });

  it("public catalog query requires an approved, unbanned, open seller", () => {
    const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    expect(db).toContain("innerJoin(sellerProfiles");
    expect(db).toContain('eq(products.status, "approved")');
    expect(db).toContain('eq(sellerProfiles.verificationStatus, "verified")');
    expect(db).toContain("eq(sellerProfiles.isBanned, 0)");
    expect(db).toContain("eq(sellerProfiles.isOpen, 1)");
  });
});

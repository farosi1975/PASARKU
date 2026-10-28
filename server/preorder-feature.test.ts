import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { products, orders } from "../drizzle/schema";

describe("Pre-Order marketplace flow", () => {
  it("keeps Pre-Order fields in the database contract", () => {
    expect(products.isPreOrder).toBeDefined();
    expect(products.preOrderDays).toBeDefined();
    expect(products.preOrderActive).toBeDefined();
    expect(orders.isPreOrder).toBeDefined();
    expect(orders.preOrderStatus).toBeDefined();
    expect(orders.preOrderReadyAt).toBeDefined();
  });

  it("uses a non-destructive migration with safe defaults", () => {
    const migration = readFileSync(new URL("../drizzle/migrations/0027_preorder.sql", import.meta.url), "utf8");
    expect(migration).toContain("isPreOrder");
    expect(migration).toContain("preOrderStatus");
    expect(migration).toContain("DEFAULT 0");
    expect(migration).not.toMatch(/DROP\s+TABLE|DROP\s+COLUMN/i);
  });

  it("keeps checkout modes separate and gates courier assignment", () => {
    const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const home = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    const seller = readFileSync(new URL("../client/src/pages/Seller.tsx", import.meta.url), "utf8");
    expect(router).toContain("markPreOrderReady:");
    expect(router).toContain("Pre-Order belum siap dari penjual.");
    expect(router).toContain("Produk biasa dan Pre-Order harus dibuat dalam checkout terpisah.");
    expect(home).toContain("Checkout produk biasa");
    expect(home).toContain("Checkout Pre-Order");
    expect(seller).toContain("Tandai siap dikirim");
  });
});

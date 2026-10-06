import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { products, orders, sellerProfiles } from "../drizzle/schema";

describe("seller and courier dashboard features", () => {
  it("keeps the new database fields in the Drizzle contract", () => {
    expect(products.imageUrl).toBeDefined();
    expect(sellerProfiles.preferredCourierId).toBeDefined();
    expect(orders.courierAcceptedAt).toBeDefined();
  });

  it("contains the reviewed non-destructive migration", () => {
    const migration = readFileSync(new URL("../drizzle/0008_acoustic_overlord.sql", import.meta.url), "utf8");
    expect(migration).toContain("ADD `imageUrl` text");
    expect(migration).toContain("ADD `preferredCourierId` int");
    expect(migration).toContain("ADD `courierAcceptedAt` timestamp");
  });

  it("exposes the seller photo and courier preference flows in the UI", () => {
    const sellerPage = readFileSync(new URL("../client/src/pages/Seller.tsx", import.meta.url), "utf8");
    const courierPage = readFileSync(new URL("../client/src/pages/Courier.tsx", import.meta.url), "utf8");
    expect(sellerPage).toContain("imageData");
    expect(sellerPage).toContain("setSellerCourier");
    expect(courierPage).toContain("acceptCourierTask");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { products, orders, sellerProfiles } from "../drizzle/schema";

describe("seller and courier dashboard features", () => {
  it("keeps the new database fields in the Drizzle contract", () => {
    expect(products.imageUrl).toBeDefined();
    expect(sellerProfiles.preferredCourierId).toBeDefined();
    expect(sellerProfiles.isOpen).toBeDefined();
    expect(orders.courierAcceptedAt).toBeDefined();
    expect(orders.currentLocation).toBeDefined();
  });

  it("contains the reviewed non-destructive migration", () => {
    const migration = readFileSync(new URL("../drizzle/0008_acoustic_overlord.sql", import.meta.url), "utf8");
    expect(migration).toContain("ADD `imageUrl` text");
    expect(migration).toContain("ADD `preferredCourierId` int");
    expect(migration).toContain("ADD `courierAcceptedAt` timestamp");
    const latestMigration = readFileSync(new URL("../drizzle/0009_nifty_moonstone.sql", import.meta.url), "utf8");
    expect(latestMigration).toContain("ADD `currentLocation` text");
    expect(latestMigration).toContain("ADD `isOpen` int DEFAULT 1 NOT NULL");
  });

  it("exposes the seller photo and courier preference flows in the UI", () => {
    const sellerPage = readFileSync(new URL("../client/src/pages/Seller.tsx", import.meta.url), "utf8");
    const courierPage = readFileSync(new URL("../client/src/pages/Courier.tsx", import.meta.url), "utf8");
    expect(sellerPage).toContain("imageData");
    expect(sellerPage).toContain("setSellerCourier");
    expect(courierPage).toContain("acceptCourierTask");
  });

  it("exposes protected product management and assignment notification flows", () => {
    const router = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const sellerPage = readFileSync(new URL("../client/src/pages/Seller.tsx", import.meta.url), "utf8");
    expect(router).toContain("updateProduct:");
    expect(router).toContain("deleteProduct:");
    expect(router).toContain("notifyCourierAssignment");
    expect(router).toContain("preferredCourierId");
    expect(sellerPage).toContain("saveProductEdit");
    expect(sellerPage).toContain("removeProduct");
    expect(sellerPage).toContain("setSellerOpen");
    expect(sellerPage).toContain("Toko buka");
    const courierPage = readFileSync(new URL("../client/src/pages/Courier.tsx", import.meta.url), "utf8");
    const homePage = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
    expect(courierPage).toContain("Masuk tanpa OTP");
    expect(courierPage).toContain("Masuk tanpa OTP. Tugas pengantaran Anda sudah dimuat.");
    expect(homePage).toContain("useCurrentLocation");
    expect(homePage).toContain("currentLocation");
  });

  it("keeps courier pickup data real and excludes completed assignment choices", () => {
    const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    const courierPage = readFileSync(new URL("../client/src/pages/Courier.tsx", import.meta.url), "utf8");
    const adminPage = readFileSync(new URL("../client/src/pages/Admin.tsx", import.meta.url), "utf8");
    expect(db).toContain("pickupShopName");
    expect(db).toContain("sellerProfiles.shopName");
    expect(courierPage).toContain("order.pickupShopName");
    expect(courierPage).toContain("const assigned = useMemo(() => courier ? remoteOrders : []");
    expect(adminPage).toContain('order.status !== "Selesai"');
  });
});

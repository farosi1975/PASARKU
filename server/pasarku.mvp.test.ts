import { describe, expect, it } from "vitest";
import { mockOrders, products, formatRupiah } from "../client/src/data/catalog";

describe("PASARKU MVP sample catalog", () => {
  it("contains the six sample offerings used by the preview", () => {
    expect(products).toHaveLength(6);
    expect(new Set(products.map((product) => product.category)).size).toBeGreaterThanOrEqual(4);
    expect(products.every((product) => product.price > 0 && product.name && product.vendor)).toBe(true);
  });

  it("keeps local delivery assumptions visible in product data", () => {
    expect(products.every((product) => product.location && product.eta)).toBe(true);
    expect(products.some((product) => product.eta.includes("30–45"))).toBe(true);
    expect(formatRupiah(12000)).toContain("12.000");
  });

  it("has an order status that can be progressed by the admin preview", () => {
    const activeStatuses = new Set(mockOrders.filter((order) => order.status !== "Selesai").map((order) => order.status));
    expect(mockOrders).toHaveLength(4);
    expect(activeStatuses).toEqual(new Set(["Menunggu", "Diproses", "Diantar"]));
    expect(mockOrders.every((order) => order.payment === "COD" || order.payment === "Transfer")).toBe(true);
  });
});

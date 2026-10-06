import { describe, expect, it } from "vitest";
import { calculateShippingCost, DEFAULT_SHIPPING_SETTINGS, distanceInKm, parseCoordinates } from "../shared/shipping";

describe("shipping calculator", () => {
  it("parses valid coordinates and rejects invalid coordinates", () => {
    expect(parseCoordinates("-7.602345, 111.904321")).toEqual({ latitude: -7.602345, longitude: 111.904321 });
    expect(parseCoordinates("alamat rumah")).toBeNull();
    expect(parseCoordinates("-91, 111")).toBeNull();
  });

  it("uses a minimum one-kilometer estimate without GPS", () => {
    expect(distanceInKm(undefined, DEFAULT_SHIPPING_SETTINGS)).toBe(1);
    expect(calculateShippingCost({ ...DEFAULT_SHIPPING_SETTINGS, ratePerKm: 3000 }, undefined)).toBe(3000);
  });

  it("applies the Admin percentage discount", () => {
    const settings = { ...DEFAULT_SHIPPING_SETTINGS, ratePerKm: 10000, discountPercent: 20 };
    expect(calculateShippingCost(settings, "-7.602345, 111.904321")).toBe(8000);
    expect(calculateShippingCost(settings, "-7.602345, 111.904321", false, 2)).toBe(16000);
  });

  it("makes the delivery fee zero for a free-shipping shop", () => {
    expect(calculateShippingCost({ ...DEFAULT_SHIPPING_SETTINGS, ratePerKm: 10000 }, "-7.7, 111.9", true)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { calculateOrderTotal, makeOrderId } from "../client/src/lib/order";

describe("digital order summary helpers", () => {
  it("creates a human-readable invoice id in the expected range", () => {
    expect(makeOrderId(0)).toBe("INV-101");
    expect(makeOrderId(0.9999)).toBe("INV-999");
  });

  it("adds the local delivery fee to the checkout subtotal", () => {
    expect(calculateOrderTotal(50000)).toBe(55000);
    expect(calculateOrderTotal(50000, 0)).toBe(50000);
  });
});

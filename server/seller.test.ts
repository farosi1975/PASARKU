import { describe, expect, it } from "vitest";
import { normalizeSellerPhone, SELLER_OTP } from "../client/src/lib/seller";

describe("seller portal preview", () => {
  it("normalizes seller WhatsApp numbers", () => {
    expect(normalizeSellerPhone("081234567890")).toBe("6281234567890");
    expect(normalizeSellerPhone("6281234567890")).toBe("6281234567890");
  });

  it("uses the documented seller demo OTP", () => {
    expect(SELLER_OTP).toBe("123456");
  });
});

import { describe, expect, it } from "vitest";
import { COURIER_OTP, normalizeCourierPhone } from "../client/src/lib/courier";

describe("courier portal preview", () => {
  it("normalizes courier WhatsApp numbers", () => {
    expect(normalizeCourierPhone("081234567890")).toBe("6281234567890");
    expect(normalizeCourierPhone("6281234567890")).toBe("6281234567890");
  });

  it("uses the documented courier demo OTP", () => {
    expect(COURIER_OTP).toBe("123456");
  });
});

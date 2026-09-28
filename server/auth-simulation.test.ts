import { describe, expect, it } from "vitest";
import { normalizeWhatsApp, SIMULATED_OTP } from "../client/src/lib/auth";

describe("PASARKU simulated user auth", () => {
  it("normalizes Indonesian WhatsApp numbers for future provider integration", () => {
    expect(normalizeWhatsApp("081234567890")).toBe("6281234567890");
    expect(normalizeWhatsApp("+6281234567890")).toBe("6281234567890");
  });

  it("uses the documented demo OTP", () => {
    expect(SIMULATED_OTP).toBe("123456");
  });
});

import { describe, expect, it } from "vitest";
import { ADMIN_WHATSAPP, buildAdminWhatsAppLink } from "../client/src/lib/whatsapp";

describe("PASARKU WhatsApp admin link", () => {
  it("targets the configured admin number and includes the invoice id", () => {
    const link = buildAdminWhatsAppLink("INV-101", "Sari Wulandari");
    expect(ADMIN_WHATSAPP).toBe("6281456015901");
    expect(link).toContain("https://wa.me/6281456015901?text=");
    expect(decodeURIComponent(link)).toContain("#INV-101");
    expect(decodeURIComponent(link)).toContain("Sari Wulandari");
  });

  it("uses the editable admin number for general help", () => {
    const link = buildAdminWhatsAppLink(undefined, undefined, "0812 3456 7890", "toko dan ongkir");
    expect(link).toContain("https://wa.me/081234567890?text=");
    expect(decodeURIComponent(link)).toContain("toko dan ongkir");
  });
});

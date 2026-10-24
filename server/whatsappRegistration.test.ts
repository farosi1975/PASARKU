import { describe, expect, it } from "vitest";
import { parseWhatsAppRegistrationMessage } from "./whatsappRegistration";

describe("parseWhatsAppRegistrationMessage", () => {
  it("membaca kode sesi tanpa terpengaruh huruf besar kecil atau spasi", () => {
    expect(parseWhatsAppRegistrationMessage("  daftar pasarku  a1b2c3d4  ")).toBe("A1B2C3D4");
  });

  it("menolak pesan yang bukan perintah pendaftaran", () => {
    expect(parseWhatsAppRegistrationMessage("DAFTAR PASARKU")).toBeNull();
    expect(parseWhatsAppRegistrationMessage("DAFTAR PASARKU kode-terlalu-panjang-123456")).toBeNull();
    expect(parseWhatsAppRegistrationMessage("Halo admin")).toBeNull();
  });
});

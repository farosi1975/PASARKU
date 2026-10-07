export const ADMIN_WHATSAPP = "6281456015901";

export function buildAdminWhatsAppLink(orderId?: string, customerName?: string, adminWhatsapp = ADMIN_WHATSAPP, context?: string) {
  const greeting = customerName ? `Halo Admin PASARKU, saya ${customerName}.` : "Halo Admin PASARKU.";
  const message = orderId
    ? `${greeting} Saya ingin konfirmasi pesanan #${orderId}. Mohon dibantu cek ketersediaan dan estimasi pengantarannya.`
    : `${greeting} Saya membutuhkan bantuan terkait ${context || "layanan PASARKU"}. Mohon dibantu.`;
  const target = adminWhatsapp.replace(/\D/g, "") || ADMIN_WHATSAPP;
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

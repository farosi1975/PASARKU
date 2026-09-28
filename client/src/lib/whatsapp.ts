export const ADMIN_WHATSAPP = "6281456015901";

export function buildAdminWhatsAppLink(orderId: string, customerName?: string) {
  const greeting = customerName ? `Halo Admin PASARKU, saya ${customerName}.` : "Halo Admin PASARKU.";
  const message = `${greeting} Saya ingin konfirmasi pesanan #${orderId}. Mohon dibantu cek ketersediaan dan estimasi pengantarannya.`;
  return `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

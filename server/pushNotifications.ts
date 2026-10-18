import webpush from "web-push";
import { deletePushSubscription, hasPromoNotificationBeenSent, listPushSubscriptions, markPromoNotificationSent, getSiteSettings } from "./db";

type PromoSlot = { id?: string; title?: string; description?: string; cta?: string; active?: boolean; startsAt?: string | Date | null; endsAt?: string | Date | null };

const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY?.trim() || "";
const vapidPrivateKey = () => process.env.VAPID_PRIVATE_KEY?.trim() || "";
const vapidSubject = () => process.env.VAPID_SUBJECT?.trim() || "mailto:admin@pasarku.local";

let configured = false;
const configureWebPush = () => {
  if (configured) return true;
  const publicKey = vapidPublicKey();
  const privateKey = vapidPrivateKey();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(vapidSubject(), publicKey, privateKey);
  configured = true;
  return true;
};

export const getPushPublicKey = () => vapidPublicKey() || null;

const parsePromoSlots = (raw: unknown): PromoSlot[] => {
  if (typeof raw !== "string") return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const isActiveSlot = (slot: PromoSlot, now: number) => {
  const starts = slot.startsAt ? new Date(slot.startsAt).getTime() : -Infinity;
  const ends = slot.endsAt ? new Date(slot.endsAt).getTime() : Infinity;
  return slot.active === true && starts <= now && ends >= now;
};

export async function sendDuePromoNotifications() {
  if (!configureWebPush()) return { sent: 0, skipped: "VAPID belum dikonfigurasi" } as const;
  const settings = await getSiteSettings();
  const slots = parsePromoSlots(settings.promoSlots);
  const now = Date.now();
  const dueSlots = slots.filter((slot) => Boolean(slot.id) && isActiveSlot(slot, now));
  if (!dueSlots.length) return { sent: 0, skipped: "Tidak ada slot promo aktif" } as const;

  const subscriptions = await listPushSubscriptions();
  let sent = 0;
  for (const slot of dueSlots) {
    if (!slot.id || await hasPromoNotificationBeenSent(slot.id)) continue;
    const payload = JSON.stringify({
      title: slot.title || "Promo PASARKU",
      body: slot.description || "Ada promo baru dari toko lokal PASARKU.",
      url: "/#promo",
      tag: `pasarku-promo-${slot.id}`,
    });
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) await deletePushSubscription(subscription.endpoint);
        else console.warn("[Push] Pengiriman promo gagal:", error instanceof Error ? error.message : error);
      }
    }
    await markPromoNotificationSent(slot.id);
  }
  return { sent } as const;
}

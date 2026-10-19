import { useEffect, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const DISMISSED_KEY = "pasarku-promo-push-dismissed";
const INSTALL_DISMISSED_KEY = "pasarku-install-prompt-dismissed-v2";

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(Array.from(raw).map(char => char.charCodeAt(0)));
}

export default function PushPromoPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const pushKey = trpc.marketplace.pushPublicKey.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: false });
  const subscribe = trpc.marketplace.subscribeToPush.useMutation();

  useEffect(() => {
    if (!pushKey.data?.publicKey || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
    const reveal = () => setVisible(true);
    if (window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1" || window.matchMedia("(display-mode: standalone)").matches) reveal();
    window.addEventListener("pasarku-install-prompt-closed", reveal);
    return () => window.removeEventListener("pasarku-install-prompt-closed", reveal);
  }, [pushKey.data?.publicKey]);

  const enable = async () => {
    if (!pushKey.data?.publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setVisible(false); return; }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(pushKey.data.publicKey) });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("Subscription perangkat belum lengkap.");
      await subscribe.mutateAsync({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, userAgent: navigator.userAgent });
      setVisible(false);
      toast.success("Notifikasi promo diaktifkan", { description: "Promo baru akan dikirim ke perangkat ini." });
    } catch (error) {
      toast.error("Notifikasi belum aktif", { description: error instanceof Error ? error.message : "Silakan coba lagi." });
    } finally { setBusy(false); }
  };

  const dismiss = () => { window.localStorage.setItem(DISMISSED_KEY, "1"); setVisible(false); };
  if (!visible) return null;
  return <aside className="push-promo-prompt" aria-label="Notifikasi promo PASARKU"><div className="push-promo-icon"><BellRing size={19} /></div><div className="push-promo-copy"><strong>Dapatkan info promo</strong><small>Terima promo baru meski PWA sedang ditutup.</small></div><button className="push-promo-enable" type="button" onClick={enable} disabled={busy}><Bell size={15} />{busy ? "Memproses..." : "Aktifkan"}</button><button className="push-promo-close" type="button" onClick={dismiss} aria-label="Tutup pemberitahuan"><X size={16} /></button></aside>;
}

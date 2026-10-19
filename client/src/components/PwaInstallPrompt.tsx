import { Download, Gift, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pasarku-install-prompt-dismissed-v2";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [manualSteps, setManualSteps] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      if (window.localStorage.getItem(DISMISSED_KEY) !== "1") setVisible(true);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setVisible(false);
      window.localStorage.setItem(DISMISSED_KEY, "1");
      window.dispatchEvent(new Event("pasarku-install-prompt-closed"));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    const timer = window.setTimeout(() => {
      if (window.localStorage.getItem(DISMISSED_KEY) !== "1") setVisible(true);
    }, 700);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = () => {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
    window.dispatchEvent(new Event("pasarku-install-prompt-closed"));
  };

  const install = async () => {
    if (!installEvent) {
      setManualSteps(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") close();
  };

  if (!visible) return null;
  return (
    <div className="pwa-install-overlay" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      <section className="pwa-install-modal">
        <button className="pwa-install-dismiss" onClick={close} type="button" aria-label="Tutup ajakan pasang"><X size={22} /></button>
        <div className="pwa-install-art"><Gift size={66} strokeWidth={1.4} /><Sparkles className="pwa-sparkle sparkle-one" size={19} /><Sparkles className="pwa-sparkle sparkle-two" size={15} /></div>
        <div className="pwa-install-kicker">PASARKU untuk warga Sawahan</div>
        <h2 id="pwa-install-title">Pasang PASARKU<br /><em>lebih mudah belanja.</em></h2>
        <p>Akses toko lokal lebih cepat dari layar utama dan tetap praktis saat dibuka dari tautan WhatsApp.</p>
        {manualSteps ? <div className="pwa-install-steps"><strong>Cara memasang dari Chrome</strong><span>1. Tekan menu ⋮ di kanan atas.</span><span>2. Pilih “Tambahkan ke layar utama”.</span><span>3. Tekan “Pasang”.</span></div> : <button className="pwa-install-cta" onClick={install} type="button"><Download size={19} /> {installEvent ? "Pasang sekarang" : "Lihat cara pasang"}</button>}
        <button className="pwa-install-later" onClick={close} type="button">Lanjutkan di browser</button>
      </section>
    </div>
  );
}

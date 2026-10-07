import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone)) return;
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !installEvent) return null;

  const install = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
  };

  return (
    <aside className="pwa-install-prompt" aria-label="Instal aplikasi PASARKU">
      <div className="pwa-install-copy">
        <strong>Pasang PASARKU</strong>
        <span>Akses lebih cepat dari layar utama.</span>
      </div>
      <button className="pwa-install-button" onClick={install} type="button">
        <Download size={15} /> Pasang
      </button>
      <button className="pwa-install-dismiss" onClick={() => setVisible(false)} type="button" aria-label="Tutup prompt instalasi">
        <X size={16} />
      </button>
    </aside>
  );
}

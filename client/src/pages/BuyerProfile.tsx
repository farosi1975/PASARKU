import { useEffect, useState } from "react";
import { ArrowLeft, Check, MapPin, MessageCircle, Save, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AUTH_EVENT, normalizeWhatsApp, USER_SESSION_KEY } from "@/lib/auth";
import { SAWAHAN_VILLAGES } from "@/lib/locations";
import { trpc } from "@/lib/trpc";

const villages = SAWAHAN_VILLAGES;

type BuyerSession = { name?: string; phone?: string };

function readSession(): BuyerSession | null {
  try {
    return JSON.parse(window.localStorage.getItem(USER_SESSION_KEY) || "null") as BuyerSession | null;
  } catch {
    return null;
  }
}

export default function BuyerProfile() {
  const [, navigate] = useLocation();
  const [session, setSession] = useState<BuyerSession | null>(() => readSession());
  const [form, setForm] = useState({ name: "", whatsapp: "", village: "Sawahan", address: "" });
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const buyerPhone = session?.phone || "";
  const profile = trpc.marketplace.buyerProfile.useQuery({ whatsapp: buyerPhone || "0000000000" }, { enabled: buyerPhone.length >= 10 });
  const saveProfile = trpc.marketplace.saveBuyerProfile.useMutation();

  useEffect(() => {
    const refreshSession = () => setSession(readSession());
    window.addEventListener(AUTH_EVENT, refreshSession);
    return () => window.removeEventListener(AUTH_EVENT, refreshSession);
  }, []);

  useEffect(() => {
    if (hasLoadedProfile || !session) return;
    if (profile.data) {
      setForm({ name: profile.data.name, whatsapp: profile.data.whatsapp, village: profile.data.village, address: profile.data.address || "" });
      setHasLoadedProfile(true);
    } else if (!profile.isLoading) {
      setForm((current) => ({ ...current, name: session.name || "", whatsapp: session.phone || "" }));
      setHasLoadedProfile(true);
    }
  }, [hasLoadedProfile, profile.data, profile.isLoading, session]);

  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const whatsapp = normalizeWhatsApp(form.whatsapp);
    if (form.name.trim().length < 2) return toast.error("Masukkan nama lengkap.");
    if (whatsapp.length < 10) return toast.error("Masukkan nomor WhatsApp yang valid.");
    if (form.address.trim().length < 3) return toast.error("Masukkan alamat lengkap agar kurir mudah menemukan rumah.");
    try {
      const saved = await saveProfile.mutateAsync({ name: form.name.trim(), whatsapp, village: form.village, address: form.address.trim() });
      setForm({ name: saved?.name || form.name.trim(), whatsapp: saved?.whatsapp || whatsapp, village: saved?.village || form.village, address: saved?.address || form.address.trim() });
      window.localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ ...session, name: saved?.name || form.name.trim(), phone: saved?.whatsapp || whatsapp }));
      window.dispatchEvent(new Event(AUTH_EVENT));
      toast.success("Profil pembeli tersimpan", { description: "Nama, WhatsApp, dan alamat kini tersinkron dengan pesanan dan panel Admin." });
    } catch (error) {
      toast.error("Profil belum tersimpan", { description: error instanceof Error ? error.message : "Database belum merespons." });
    }
  };

  if (!session?.phone) {
    return <div className="auth-page"><header className="auth-header"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link></header><main className="auth-main"><section className="auth-card"><div className="auth-card-top"><div className="auth-icon"><UserRound size={23} /></div><div className="eyebrow">Profil pembeli</div><h1>Masuk untuk melengkapi<br /><em>data Anda.</em></h1><p>Profil menyimpan alamat pengantaran agar checkout lebih cepat dan tim Admin dapat menindaklanjuti pesanan.</p></div><Link href="/masuk" className="primary-button full-width">Masuk / Daftar <Check size={17} /></Link></section></main></div>;
  }

  return <div className="auth-page"><div className="auth-orbit auth-orbit-one"></div><div className="auth-orbit auth-orbit-two"></div><header className="auth-header"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><Link href="/" className="back-link"><ArrowLeft size={15} /> Kembali ke etalase</Link></header><main className="auth-main"><section className="auth-card profile-card"><div className="auth-card-top"><div className="auth-icon"><UserRound size={23} /></div><div className="eyebrow">Profil pembeli</div><h1>Alamat tersimpan,<br /><em>checkout lebih cepat.</em></h1><p>Data ini dipakai untuk nota pesanan dan diteruskan ke Admin PASARKU serta kurir yang ditugaskan.</p></div><form className="auth-form" onSubmit={submit}><label>Nama lengkap<div className="auth-input"><UserRound size={16} /><input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Contoh: Sari Wulandari" /></div></label><label>Nomor WhatsApp<div className="auth-input"><MessageCircle size={16} /><input value={form.whatsapp} onChange={(event) => setField("whatsapp", event.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div><small>Nomor terverifikasi dari akun Anda; boleh diperbarui jika diperlukan.</small></label><label>Desa / wilayah<div className="auth-input"><MapPin size={16} /><select value={form.village} onChange={(event) => setField("village", event.target.value)}>{villages.map((village) => <option key={village}>{village}</option>)}</select></div></label><label>Alamat lengkap<div className="auth-input"><MapPin size={16} /><textarea value={form.address} onChange={(event) => setField("address", event.target.value)} placeholder="Dusun, RT/RW, patokan rumah" rows={3} /></div></label><button className="primary-button full-width" type="submit" disabled={saveProfile.isPending}>{saveProfile.isPending ? "Menyimpan..." : "Simpan profil"} <Save size={17} /></button></form><div className="auth-note"><Check size={15} /><span>Profil tersinkron ke database PASARKU saat disimpan.</span></div></section><aside className="auth-side"><div className="auth-side-label">Satu data untuk semua</div><h2>Admin tahu harus<br /><em>mengantar ke mana.</em></h2><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Checkout lebih cepat</strong><small>Alamat tersimpan otomatis di form pesanan</small></div></div><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Nota lebih lengkap</strong><small>Nama, WhatsApp, desa, dan alamat ikut tersimpan</small></div></div><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Koordinasi lebih mudah</strong><small>Admin melihat detail pembeli di panel operasional</small></div></div></aside></main><footer className="auth-footer">PASARKU · Marketplace lokal Kecamatan Sawahan, Nganjuk</footer></div>;
}

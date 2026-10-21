import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, KeyRound, LockKeyhole, MapPin, MessageCircle, Phone, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AUTH_EVENT, normalizeWhatsApp, USER_SESSION_KEY } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

type Mode = "login" | "registerOtp" | "registerManual" | "registerWhatsApp";
type PendingRegistration = { name: string; phone: string; registrationToken: string };
const PENDING_REGISTRATION_KEY = "pasarku_pending_buyer_registration";
const WHATSAPP_REGISTRATION_KEY = "pasarku_whatsapp_registration";

function readPendingRegistration(): PendingRegistration | null {
  try { return JSON.parse(window.localStorage.getItem(PENDING_REGISTRATION_KEY) || "null") as PendingRegistration | null; } catch { return null; }
}
function readWhatsAppRegistration(): string | null {
  try { return window.localStorage.getItem(WHATSAPP_REGISTRATION_KEY); } catch { return null; }
}

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("Sawahan");
  const [address, setAddress] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(() => readPendingRegistration());
  const [whatsappRequestCode, setWhatsappRequestCode] = useState<string | null>(() => readWhatsAppRegistration());
  const requestBuyerOtp = trpc.marketplace.requestBuyerOtp.useMutation();
  const verifyBuyerOtp = trpc.marketplace.verifyBuyerOtp.useMutation();
  const registerBuyer = trpc.marketplace.registerBuyer.useMutation();
  const createWhatsAppRegistration = trpc.marketplace.createWhatsAppRegistration.useMutation();
  const shippingSettings = trpc.marketplace.shippingSettings.useQuery();
  const registrationStatus = trpc.marketplace.buyerRegistrationStatus.useQuery(pendingRegistration ? { whatsapp: pendingRegistration.phone, registrationToken: pendingRegistration.registrationToken } : { whatsapp: "0000000000", registrationToken: "pending-registration-check" }, { enabled: Boolean(pendingRegistration), refetchInterval: pendingRegistration ? 5000 : false });
  const whatsappStatus = trpc.marketplace.whatsappRegistrationStatus.useQuery({ requestCode: whatsappRequestCode || "00000000" }, { enabled: Boolean(whatsappRequestCode), refetchInterval: whatsappRequestCode ? 3000 : false });

  useEffect(() => {
    if (!whatsappRequestCode) return;
    setMode((current) => current === "login" ? "registerWhatsApp" : current);
    const refreshStatus = () => { void whatsappStatus.refetch(); };
    const handleVisibility = () => { if (document.visibilityState === "visible") refreshStatus(); };
    window.addEventListener("focus", refreshStatus);
    window.addEventListener("pageshow", refreshStatus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", refreshStatus);
      window.removeEventListener("pageshow", refreshStatus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [whatsappRequestCode, whatsappStatus.refetch]);

  useEffect(() => {
    if (registrationStatus.data?.status === "verified" && pendingRegistration) {
      window.localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ name: registrationStatus.data.name, phone: registrationStatus.data.whatsapp, mode: "registerManual", signedInAt: new Date().toISOString() }));
      window.localStorage.removeItem(PENDING_REGISTRATION_KEY); setPendingRegistration(null); window.dispatchEvent(new Event(AUTH_EVENT));
      toast.success("Akun disetujui Admin", { description: `Selamat datang di PASARKU, ${registrationStatus.data.name}.` }); navigate("/");
    }
  }, [registrationStatus.data, pendingRegistration, navigate]);

  useEffect(() => {
    const status = whatsappStatus.data;
    if (status?.status === "verified" && status.whatsapp) {
      window.localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ name: `Warga ${status.whatsapp.slice(-4)}`, phone: status.whatsapp, mode: "registerWhatsApp", signedInAt: new Date().toISOString() }));
      window.localStorage.removeItem(WHATSAPP_REGISTRATION_KEY); setWhatsappRequestCode(null); window.dispatchEvent(new Event(AUTH_EVENT));
      toast.success("Berhasil masuk ke PASARKU", { description: "Nomor WhatsApp Anda sudah terdaftar. Silakan mulai belanja." });
      window.location.replace("/");
    }
  }, [whatsappStatus.data, navigate]);

  const selectMode = (nextMode: Mode) => { setMode(nextMode); setStep("phone"); setOtp(""); setChallengeToken(""); };
  const registerManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return toast.error("Masukkan nama lengkap Anda.");
    if (village.trim().length < 2) return toast.error("Masukkan desa atau kecamatan.");
    if (address.trim().length < 2) return toast.error("Masukkan alamat lengkap.");
    const normalized = normalizeWhatsApp(phone); if (normalized.length < 10) return toast.error("Masukkan nomor WhatsApp yang valid.");
    try { const result = await registerBuyer.mutateAsync({ name: name.trim(), whatsapp: normalized, village: village.trim(), address: address.trim() }); const pending = { name: result.name, phone: result.whatsapp, registrationToken: result.registrationToken }; window.localStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(pending)); setPendingRegistration(pending); toast.success("Pendaftaran berhasil dikirim", { description: "Admin akan memeriksa data Anda dan mengirim hasilnya melalui WhatsApp." }); }
    catch (error) { toast.error("Pendaftaran belum berhasil", { description: error instanceof Error ? error.message : "Periksa data dan coba lagi." }); }
  };
  const registerViaWhatsApp = async () => {
    const popup = window.open("about:blank", "_blank");
    try {
      const result = await createWhatsAppRegistration.mutateAsync();
      setWhatsappRequestCode(result.requestCode); window.localStorage.setItem(WHATSAPP_REGISTRATION_KEY, result.requestCode);
      const target = normalizeWhatsApp(shippingSettings.data?.adminWhatsapp || "6281456015901");
      const message = encodeURIComponent(`DAFTAR PASARKU ${result.requestCode}`);
      const url = `https://wa.me/${target}?text=${message}`;
      if (popup) popup.location.href = url; else window.location.href = url;
      toast.success("WhatsApp dibuka", { description: "Tekan Kirim pada pesan yang sudah disiapkan. Setelah itu PASARKU akan masuk otomatis." });
    } catch (error) { popup?.close(); toast.error("Pendaftaran WhatsApp belum siap", { description: error instanceof Error ? error.message : "Coba lagi beberapa saat." }); }
  };
  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault(); const normalized = normalizeWhatsApp(phone); if (normalized.length < 10) return toast.error("Masukkan nomor WhatsApp yang valid.");
    try { const result = await requestBuyerOtp.mutateAsync({ whatsapp: normalized, ...(mode === "registerOtp" ? { name: name.trim() } : {}) }); setSentTo(normalized); setChallengeToken(result.challengeToken); setStep("otp"); toast.success("OTP WhatsApp terkirim", { description: `Periksa WhatsApp +${normalized}.` }); }
    catch (error) { toast.error("OTP belum dapat dikirim", { description: error instanceof Error ? error.message : "Periksa koneksi FONNTE dan coba lagi." }); }
  };
  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault(); if (otp.length !== 6) return toast.error("Masukkan 6 digit OTP dari WhatsApp.");
    try { const profile = await verifyBuyerOtp.mutateAsync({ whatsapp: sentTo, otp, challengeToken }); window.localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ name: profile.name, phone: profile.whatsapp, mode, signedInAt: new Date().toISOString() })); window.dispatchEvent(new Event(AUTH_EVENT)); toast.success(mode === "registerOtp" ? "Akun berhasil dibuat" : "Berhasil masuk", { description: `Selamat datang di PASARKU, ${profile.name}.` }); navigate("/"); }
    catch (error) { const message = error instanceof Error ? error.message : "Masukkan kode terbaru dari WhatsApp."; toast.error(/OTP belum benar|OTP belum benar atau|kedaluwarsa|Percobaan tersisa/i.test(message) ? "OTP belum benar" : "Login belum selesai", { description: message }); }
  };
  const reset = () => { setStep("phone"); setOtp(""); setChallengeToken(""); };
  const isManual = mode === "registerManual"; const isOtpRegistration = mode === "registerOtp"; const isWhatsApp = mode === "registerWhatsApp";
  const isBusy = registerBuyer.isPending || requestBuyerOtp.isPending || verifyBuyerOtp.isPending || createWhatsAppRegistration.isPending;
  const pendingStatus = registrationStatus.data?.status;

  return <div className="auth-page"><div className="auth-orbit auth-orbit-one"></div><div className="auth-orbit auth-orbit-two"></div><header className="auth-header"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><Link href="/" className="back-link"><ArrowLeft size={15} /> Kembali ke etalase</Link></header><main className="auth-main"><section className="auth-card"><div className="auth-card-top"><div className="auth-icon">{step === "phone" ? <MessageCircle size={23} /> : <LockKeyhole size={23} />}</div><div className="eyebrow">Akun warga PASARKU</div><h1>{step === "phone" ? <>Belanja lebih mudah<br /><em>di sekitar Anda.</em></> : <>Masukkan kode<br /><em>verifikasi.</em></>}</h1><p>{step === "phone" ? isWhatsApp ? "Daftar paling mudah. Kirim satu pesan WhatsApp dan Anda langsung masuk ke PASARKU." : isManual ? "Daftar tanpa OTP. Admin akan memeriksa data dan mengirim hasilnya melalui WhatsApp." : isOtpRegistration ? "Daftar dengan OTP WhatsApp untuk langsung membuat akun pembeli." : "Masuk dengan nomor WhatsApp untuk melihat pesanan dan mendapatkan pengalaman belanja yang lebih personal." : <>Kode OTP 6 digit telah dikirim melalui FONNTE ke <strong>+{sentTo}</strong>.</>}</p></div>{step === "phone" ? <><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => selectMode("login")}>Masuk</button><button className={mode === "registerOtp" ? "active" : ""} onClick={() => selectMode("registerOtp")}>Daftar OTP</button><button className={mode === "registerManual" ? "active" : ""} onClick={() => selectMode("registerManual")}>Daftar manual</button><button className={mode === "registerWhatsApp" ? "active" : ""} onClick={() => selectMode("registerWhatsApp")}>Daftar lewat WhatsApp</button></div>{isWhatsApp ? <div className="auth-form"><div className="demo-otp"><div><span><MessageCircle size={15} /> Daftar cepat WhatsApp</span><strong>1 klik</strong></div><small>Nomor WhatsApp pengirim akan menjadi akun PASARKU. Tidak perlu mengetik nama, nomor, atau OTP.</small></div>{whatsappRequestCode && whatsappStatus.data?.status === "pending" ? <div className="demo-otp"><div><span><RefreshCw size={15} /> Menunggu pesan</span><strong>Aktif</strong></div><small>Tekan Kirim pada chat WhatsApp yang terbuka. Halaman ini akan masuk otomatis setelah pesan diterima.</small></div> : null}<button className="primary-button full-width" type="button" onClick={registerViaWhatsApp} disabled={isBusy}>{createWhatsAppRegistration.isPending ? "Menyiapkan WhatsApp..." : whatsappRequestCode && whatsappStatus.data?.status === "pending" ? "Buka WhatsApp lagi" : "Daftar lewat WhatsApp"} <MessageCircle size={17} /></button></div> : isManual ? pendingRegistration ? <div className="auth-form"><div className="demo-otp"><div><span><ShieldCheck size={15} /> Status pendaftaran</span><strong>{pendingStatus === "unverified" ? "Ditolak" : "Menunggu"}</strong></div><small>{pendingStatus === "unverified" ? "Pendaftaran belum disetujui. Silakan hubungi Admin PASARKU." : "Admin sedang memeriksa data Anda. Halaman ini akan otomatis login setelah Admin menyetujui dan notifikasi WhatsApp dikirim."}</small></div><button className="resend-button" type="button" onClick={() => { window.localStorage.removeItem(PENDING_REGISTRATION_KEY); setPendingRegistration(null); }}>Daftar dengan nomor lain</button></div> : <form className="auth-form" onSubmit={registerManual}><label>Nama lengkap<div className="auth-input"><UserRound size={16} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Sari Wulandari" /></div></label><label>Nomor WhatsApp<div className="auth-input"><Phone size={16} /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div></label><label>Desa / Kecamatan<div className="auth-input"><MapPin size={16} /><input value={village} onChange={(event) => setVillage(event.target.value)} placeholder="Contoh: Sawahan" /></div></label><label>Alamat lengkap<div className="auth-input"><MapPin size={16} /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Contoh: RT 01, RW 02, Dusun..." /></div></label><div className="demo-otp"><div><span><ShieldCheck size={15} /> Verifikasi manual Admin</span><strong>Tanpa OTP</strong></div><small>Hasil persetujuan dikirim ke WhatsApp. Jika disetujui, halaman ini otomatis membuat Anda login.</small></div><button className="primary-button full-width" type="submit" disabled={isBusy}>{registerBuyer.isPending ? "Menyimpan pendaftaran..." : "Daftar tanpa OTP"} <ArrowRight size={17} /></button></form> : <form className="auth-form" onSubmit={requestOtp}>{isOtpRegistration && <label>Nama lengkap<div className="auth-input"><UserRound size={16} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Sari Wulandari" /></div></label>}<label>Nomor WhatsApp<div className="auth-input"><Phone size={16} /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div><small>{isOtpRegistration ? "OTP digunakan untuk membuat akun pembeli." : "OTP digunakan saat masuk setelah akun disetujui Admin."}</small></label><button className="primary-button full-width" type="submit" disabled={requestBuyerOtp.isPending}>{requestBuyerOtp.isPending ? "Mengirim OTP..." : isOtpRegistration ? "Kirim OTP untuk daftar" : "Kirim kode OTP"} <ArrowRight size={17} /></button></form>}</> : <form className="auth-form" onSubmit={verifyOtp}><label>Kode OTP<div className="auth-input otp-input"><KeyRound size={16} /><input autoFocus value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" maxLength={6} /><Eye size={16} /></div></label><div className="demo-otp"><div><span><ShieldCheck size={15} /> OTP WhatsApp aktif</span><strong>6 digit</strong></div><small>Periksa pesan WhatsApp dari PASARKU. Kode berlaku 5 menit.</small></div><button className="primary-button full-width" type="submit" disabled={verifyBuyerOtp.isPending}>{verifyBuyerOtp.isPending ? "Memverifikasi..." : "Verifikasi & lanjut"} <Check size={17} /></button><button className="resend-button" type="button" onClick={reset}><RefreshCw size={14} /> Ganti nomor</button></form>}<div className="auth-note"><ShieldCheck size={15} /><span>{isWhatsApp ? "Nomor pengirim WhatsApp menjadi akun pembeli PASARKU." : isManual ? "Pendaftaran manual akan diverifikasi Admin dan hasilnya dikirim melalui WhatsApp." : isOtpRegistration ? "OTP akan membuat akun pembeli setelah kode benar." : "OTP dikirim melalui FONNTE dan profil tersimpan di database PASARKU."}</span></div></section><aside className="auth-side"><div className="auth-side-label">Kenapa daftar?</div><h2>Satu akun untuk<br /><em>pasar lokal Anda.</em></h2><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Lacak pesanan</strong><small>Nota digital tersimpan di akun</small></div></div><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Checkout lebih cepat</strong><small>Alamat tidak perlu diketik ulang</small></div></div><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Pilih cara daftar</strong><small>OTP, manual Admin, atau WhatsApp</small></div></div></aside></main><footer className="auth-footer">PASARKU · Marketplace lokal Kecamatan Sawahan, Nganjuk</footer></div>;
}

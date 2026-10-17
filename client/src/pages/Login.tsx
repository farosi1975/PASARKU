import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, LockKeyhole, MapPin, MessageCircle, Phone, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AUTH_EVENT, normalizeWhatsApp, USER_SESSION_KEY } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

type Mode = "login" | "register";

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
  const requestBuyerOtp = trpc.marketplace.requestBuyerOtp.useMutation();
  const verifyBuyerOtp = trpc.marketplace.verifyBuyerOtp.useMutation();
  const registerBuyer = trpc.marketplace.registerBuyer.useMutation();

  const selectMode = (nextMode: Mode) => {
    setMode(nextMode);
    setStep("phone");
    setOtp("");
    setChallengeToken("");
  };

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) return toast.error("Masukkan nama lengkap Anda.");
    if (village.trim().length < 2) return toast.error("Masukkan desa atau kecamatan.");
    if (address.trim().length < 2) return toast.error("Masukkan alamat lengkap.");
    const normalized = normalizeWhatsApp(phone);
    if (normalized.length < 10) return toast.error("Masukkan nomor WhatsApp yang valid.");
    try {
      await registerBuyer.mutateAsync({ name: name.trim(), whatsapp: normalized, village: village.trim(), address: address.trim() });
      toast.success("Pendaftaran berhasil dikirim", { description: "Akun Anda menunggu verifikasi manual Admin PASARKU. Setelah disetujui, silakan masuk dengan OTP WhatsApp." });
      setMode("login");
      setName("");
      setAddress("");
    } catch (error) {
      toast.error("Pendaftaran belum berhasil", { description: error instanceof Error ? error.message : "Periksa data dan coba lagi." });
    }
  };

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeWhatsApp(phone);
    if (normalized.length < 10) return toast.error("Masukkan nomor WhatsApp yang valid.");
    try {
      const result = await requestBuyerOtp.mutateAsync({ whatsapp: normalized });
      setSentTo(normalized);
      setChallengeToken(result.challengeToken);
      setStep("otp");
      toast.success("OTP WhatsApp terkirim", { description: `Periksa WhatsApp +${normalized}.` });
    } catch (error) {
      toast.error("OTP belum dapat dikirim", { description: error instanceof Error ? error.message : "Periksa koneksi FONNTE dan coba lagi." });
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (otp.length !== 6) return toast.error("Masukkan 6 digit OTP dari WhatsApp.");
    try {
      const profile = await verifyBuyerOtp.mutateAsync({ whatsapp: sentTo, otp, challengeToken });
      window.localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ name: profile.name, phone: profile.whatsapp, mode: "login", signedInAt: new Date().toISOString() }));
      window.dispatchEvent(new Event(AUTH_EVENT));
      toast.success("Berhasil masuk", { description: `Selamat datang di PASARKU, ${profile.name}.` });
      navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Masukkan kode terbaru dari WhatsApp.";
      const isOtpError = /OTP belum benar|OTP belum benar atau|kedaluwarsa|Percobaan tersisa/i.test(message);
      toast.error(isOtpError ? "OTP belum benar" : "Login belum selesai", { description: message });
    }
  };

  const reset = () => { setStep("phone"); setOtp(""); setChallengeToken(""); };
  const isRegister = mode === "register";
  const isBusy = registerBuyer.isPending || requestBuyerOtp.isPending || verifyBuyerOtp.isPending;

  return <div className="auth-page"><div className="auth-orbit auth-orbit-one"></div><div className="auth-orbit auth-orbit-two"></div><header className="auth-header"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><Link href="/" className="back-link"><ArrowLeft size={15} /> Kembali ke etalase</Link></header><main className="auth-main"><section className="auth-card"><div className="auth-card-top"><div className="auth-icon">{step === "phone" ? <MessageCircle size={23} /> : <LockKeyhole size={23} />}</div><div className="eyebrow">Akun warga PASARKU</div><h1>{step === "phone" ? <>Belanja lebih mudah<br /><em>di sekitar Anda.</em></> : <>Masukkan kode<br /><em>verifikasi.</em></>}</h1><p>{step === "phone" ? (isRegister ? "Isi data diri untuk mendaftar sebagai pembeli. Admin akan memeriksa pendaftaran Anda secara manual." : "Masuk dengan nomor WhatsApp untuk melihat pesanan dan mendapatkan pengalaman belanja yang lebih personal.") : <>Kode OTP 6 digit telah dikirim melalui FONNTE ke <strong>+{sentTo}</strong>.</>}</p></div>{step === "phone" ? <><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => selectMode("login")}>Masuk</button><button className={mode === "register" ? "active" : ""} onClick={() => selectMode("register")}>Daftar baru</button></div>{isRegister ? <form className="auth-form" onSubmit={register}><label>Nama lengkap<div className="auth-input"><UserRound size={16} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Sari Wulandari" /></div></label><label>Nomor WhatsApp<div className="auth-input"><Phone size={16} /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div></label><label>Desa / Kecamatan<div className="auth-input"><MapPin size={16} /><input value={village} onChange={(event) => setVillage(event.target.value)} placeholder="Contoh: Sawahan" /></div></label><label>Alamat lengkap<div className="auth-input"><MapPin size={16} /><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Contoh: RT 01, RW 02, Dusun..." /></div></label><div className="demo-otp"><div><span><ShieldCheck size={15} /> Verifikasi manual Admin</span><strong>Tanpa OTP</strong></div><small>Pendaftaran tersimpan sebagai pembeli pending dan diproses oleh Admin PASARKU.</small></div><button className="primary-button full-width" type="submit" disabled={isBusy}>{registerBuyer.isPending ? "Menyimpan pendaftaran..." : "Daftar sebagai pembeli"} <ArrowRight size={17} /></button></form> : <form className="auth-form" onSubmit={requestOtp}><label>Nomor WhatsApp<div className="auth-input"><Phone size={16} /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div><small>OTP digunakan saat masuk setelah akun disetujui Admin.</small></label><button className="primary-button full-width" type="submit" disabled={requestBuyerOtp.isPending}>{requestBuyerOtp.isPending ? "Mengirim OTP..." : "Kirim kode OTP"} <ArrowRight size={17} /></button></form>}</> : <form className="auth-form" onSubmit={verifyOtp}><label>Kode OTP<div className="auth-input otp-input"><LockKeyhole size={16} /><input autoFocus value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" maxLength={6} /><Eye size={16} /></div></label><div className="demo-otp"><div><span><ShieldCheck size={15} /> OTP WhatsApp aktif</span><strong>6 digit</strong></div><small>Periksa pesan WhatsApp dari PASARKU. Kode berlaku 5 menit.</small></div><button className="primary-button full-width" type="submit" disabled={verifyBuyerOtp.isPending}>{verifyBuyerOtp.isPending ? "Memverifikasi..." : "Verifikasi & lanjut"} <Check size={17} /></button><button className="resend-button" type="button" onClick={reset}><RefreshCw size={14} /> Ganti nomor</button></form>}<div className="auth-note"><ShieldCheck size={15} /><span>{isRegister ? "Pendaftaran pembeli baru harus disetujui Admin sebelum dapat masuk." : "OTP dikirim melalui FONNTE dan profil tersimpan di database PASARKU."}</span></div></section><aside className="auth-side"><div className="auth-side-label">Kenapa daftar?</div><h2>Satu akun untuk<br /><em>pasar lokal Anda.</em></h2><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Lacak pesanan</strong><small>Nota digital tersimpan di akun</small></div></div><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Checkout lebih cepat</strong><small>Alamat tidak perlu diketik ulang</small></div></div><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Verifikasi manual</strong><small>Admin memeriksa data pendaftaran</small></div></div></aside></main><footer className="auth-footer">PASARKU · Marketplace lokal Kecamatan Sawahan, Nganjuk</footer></div>;
}

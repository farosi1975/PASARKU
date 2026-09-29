import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, LockKeyhole, MessageCircle, Phone, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AUTH_EVENT, normalizeWhatsApp, SIMULATED_OTP, USER_SESSION_KEY } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const saveBuyerProfile = trpc.marketplace.saveBuyerProfile.useMutation();

  const requestOtp = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "register" && !name.trim()) return toast.error("Masukkan nama Anda terlebih dahulu.");
    const normalized = normalizeWhatsApp(phone);
    if (normalized.length < 10) return toast.error("Masukkan nomor WhatsApp yang valid.");
    setSentTo(normalized);
    setStep("otp");
    setShowDemo(true);
    toast.success("Kode OTP simulasi siap", { description: `Kode dikirim ke +${normalized} (simulasi).` });
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (otp !== SIMULATED_OTP) return toast.error("Kode OTP belum benar. Gunakan kode simulasi yang ditampilkan.");
    const displayName = mode === "register" ? name.trim() : `Warga ${sentTo.slice(-4)}`;
    if (mode === "register") {
      try {
        await saveBuyerProfile.mutateAsync({ name: displayName, whatsapp: sentTo, village: "Sawahan", address: "" });
      } catch {
        toast.warning("Akun dibuat, tetapi profil belum tersinkron", { description: "Profil dapat dilengkapi dari menu Profil pengguna." });
      }
    }
    window.localStorage.setItem(USER_SESSION_KEY, JSON.stringify({ name: displayName, phone: sentTo, mode, signedInAt: new Date().toISOString() }));
    window.dispatchEvent(new Event(AUTH_EVENT));
    toast.success(mode === "register" ? "Akun berhasil dibuat" : "Berhasil masuk", { description: `Selamat datang di PASARKU, ${displayName}.` });
    navigate("/");
  };

  const reset = () => { setStep("phone"); setOtp(""); setShowDemo(false); };
  return <div className="auth-page"><div className="auth-orbit auth-orbit-one"></div><div className="auth-orbit auth-orbit-two"></div><header className="auth-header"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><Link href="/" className="back-link"><ArrowLeft size={15} /> Kembali ke etalase</Link></header><main className="auth-main"><section className="auth-card"><div className="auth-card-top"><div className="auth-icon">{step === "phone" ? <MessageCircle size={23} /> : <LockKeyhole size={23} />}</div><div className="eyebrow">Akun warga PASARKU</div><h1>{step === "phone" ? <>Belanja lebih mudah<br /><em>di sekitar Anda.</em></> : <>Masukkan kode<br /><em>verifikasi.</em></>}</h1><p>{step === "phone" ? "Masuk atau daftar dengan nomor WhatsApp untuk melihat pesanan dan mendapatkan pengalaman belanja yang lebih personal." : <>Kode 6 digit simulasi telah dikirim ke <strong>+{sentTo}</strong>.</>}</p></div>{step === "phone" ? <><div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Masuk</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Daftar baru</button></div><form className="auth-form" onSubmit={requestOtp}>{mode === "register" && <label>Nama lengkap<div className="auth-input"><UserRound size={16} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Sari Wulandari" /></div></label>}<label>Nomor WhatsApp<div className="auth-input"><Phone size={16} /><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" /></div><small>Contoh: 081234567890</small></label><button className="primary-button full-width" type="submit">Kirim kode OTP <ArrowRight size={17} /></button></form></> : <form className="auth-form" onSubmit={verifyOtp}><label>Kode OTP<div className="auth-input otp-input"><LockKeyhole size={16} /><input autoFocus value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" maxLength={6} /><Eye size={16} /></div></label>{showDemo && <div className="demo-otp"><div><span><ShieldCheck size={15} /> Mode simulasi aktif</span><strong>{SIMULATED_OTP}</strong></div><small>Dalam mode nyata, kode ini akan dikirim melalui WhatsApp.</small></div>}<button className="primary-button full-width" type="submit">Verifikasi & lanjut <Check size={17} /></button><button className="resend-button" type="button" onClick={reset}><RefreshCw size={14} /> Ganti nomor</button></form>}<div className="auth-note"><ShieldCheck size={15} /><span>Data simulasi tersimpan hanya di browser ini. KYC belum diaktifkan.</span></div></section><aside className="auth-side"><div className="auth-side-label">Kenapa daftar?</div><h2>Satu akun untuk<br /><em>pasar lokal Anda.</em></h2><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Lacak pesanan</strong><small>Nota digital tersimpan di akun</small></div></div><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Checkout lebih cepat</strong><small>Alamat tidak perlu diketik ulang</small></div></div><div className="auth-benefit"><span><Check size={14} /></span><div><strong>Terhubung dengan warga</strong><small>Dukungan lokal, lebih dekat</small></div></div></aside></main><footer className="auth-footer">PASARKU · Marketplace lokal Kecamatan Sawahan, Nganjuk</footer></div>;
}

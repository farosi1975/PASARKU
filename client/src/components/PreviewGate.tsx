import { useState, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { AUTH_EVENT, USER_SESSION_KEY } from "@/lib/auth";

const PREVIEW_PASSWORD = "pasarku2016";
const ACCESS_KEY = "pasarku_preview_unlocked_v2";

export default function PreviewGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => window.localStorage.getItem(ACCESS_KEY) === "true");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  if (unlocked) return <>{children}</>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password === PREVIEW_PASSWORD) {
      window.localStorage.setItem(ACCESS_KEY, "true");
      window.localStorage.removeItem(USER_SESSION_KEY);
      window.dispatchEvent(new Event(AUTH_EVENT));
      setUnlocked(true);
      setError("");
      return;
    }
    setError("Password belum benar. Silakan coba lagi.");
    setPassword("");
  };

  return <main className="gate-page"><div className="gate-orbit gate-orbit-one"></div><div className="gate-orbit gate-orbit-two"></div><section className="gate-card"><div className="gate-brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></div><div className="gate-lock"><LockKeyhole size={23} /></div><div className="eyebrow">Pratinjau terbatas</div><h1>Selamat datang di<br /><em>PASARKU.</em></h1><p>Halaman ini sedang dibagikan secara terbatas untuk diskusi tim. Masukkan password untuk melihat pratinjau marketplace lokal Sawahan.</p><form onSubmit={submit} className="gate-form"><label>Password akses<div className="gate-input"><LockKeyhole size={16} /><input autoFocus type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Masukkan password" aria-invalid={Boolean(error)} /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>{error && <div className="gate-error">{error}</div>}<button className="primary-button full-width" type="submit">Buka pratinjau <ArrowRight size={17} /></button></form><div className="gate-note"><ShieldCheck size={15} /><span>Akses tersimpan di browser ini. Jangan bagikan password di ruang publik.</span></div></section><div className="gate-footer">PASARKU · Marketplace lokal Kecamatan Sawahan, Nganjuk</div></main>;
}

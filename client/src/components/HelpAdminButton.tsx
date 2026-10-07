import { MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { buildAdminWhatsAppLink } from "@/lib/whatsapp";

type HelpAdminButtonProps = { context?: string; compact?: boolean };

type BuyerSession = { name?: string; phone?: string };

function readSession(): BuyerSession {
  try { return JSON.parse(window.localStorage.getItem("pasarku_user_session") || "{}") as BuyerSession; } catch { return {}; }
}

function isSupportOpen(opening: string, closing: string) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const current = now.getHours() * 60 + now.getMinutes();
  const parse = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  const start = parse(opening); const end = parse(closing);
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

export function HelpAdminButton({ context = "pertanyaan umum", compact = false }: HelpAdminButtonProps) {
  const settings = trpc.marketplace.shippingSettings.useQuery();
  const createTicket = trpc.marketplace.createSupportTicket.useMutation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => { const session = readSession(); return { name: session.name || "", whatsapp: session.phone || "", message: "" }; });
  const supportOpen = isSupportOpen(settings.data?.supportOpeningTime || "08:00", settings.data?.supportClosingTime || "20:00");
  const whatsapp = settings.data?.adminWhatsapp;
  const directHref = buildAdminWhatsAppLink(undefined, form.name || undefined, whatsapp, `${context}${supportOpen ? "" : " (di luar jam layanan)"}`);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 2 || form.whatsapp.replace(/\D/g, "").length < 10 || form.message.trim().length < 3) return toast.error("Lengkapi nama, WhatsApp, dan pesan bantuan.");
    createTicket.mutate({ customerName: form.name.trim(), whatsapp: form.whatsapp, context, message: form.message.trim() }, { onSuccess: (ticket) => { toast.success(`Tiket ${ticket.ticketCode} dibuat`, { description: "Permintaan tersimpan. WhatsApp Admin akan dibuka." }); setOpen(false); window.open(buildAdminWhatsAppLink(undefined, form.name, whatsapp, `tiket ${ticket.ticketCode}: ${context}`), "_blank", "noopener,noreferrer"); }, onError: (error) => toast.error("Tiket belum tersimpan", { description: error.message }) });
  };
  return <div className="help-admin-wrap">
    <button className={`help-admin-button${compact ? " compact" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}><MessageCircle size={compact ? 15 : 17} />{compact ? "Bantuan Admin" : "Chat Bantuan Admin"}</button>
    {open && <div className="help-admin-popover"><div className="help-admin-popover-head"><div><strong>{supportOpen ? "Bantuan Admin" : "Di luar jam layanan"}</strong><small>{supportOpen ? `Layanan ${settings.data?.supportOpeningTime || "08:00"}–${settings.data?.supportClosingTime || "20:00"} WIB` : `Jam layanan ${settings.data?.supportOpeningTime || "08:00"}–${settings.data?.supportClosingTime || "20:00"} WIB. Tiket tetap dapat dibuat.`}</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Tutup bantuan"><X size={16} /></button></div><form onSubmit={submit} className="help-admin-form"><input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Nama Anda" /><input value={form.whatsapp} onChange={(e) => setForm((v) => ({ ...v, whatsapp: e.target.value }))} placeholder="No. WhatsApp" inputMode="tel" /><textarea value={form.message} onChange={(e) => setForm((v) => ({ ...v, message: e.target.value }))} placeholder="Tuliskan kebutuhan bantuan..." rows={3} /><div className="help-admin-actions"><a href={directHref} target="_blank" rel="noreferrer" className="outline-button">Buka WA langsung</a><button className="primary-button" type="submit" disabled={createTicket.isPending}><Send size={14} />{createTicket.isPending ? "Menyimpan..." : "Buat tiket"}</button></div></form></div>}
  </div>;
}

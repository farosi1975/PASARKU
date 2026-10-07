import { Printer, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { formatRupiah } from "@/data/catalog";

export type PrintableOrderItem = { name: string; price: number; quantity: number };

export type PrintableOrder = {
  id: string;
  customer: string;
  whatsapp?: string;
  village?: string;
  address?: string;
  currentLocation?: string | null;
  pickupLocation?: string | null;
  pickupShopName?: string | null;
  pickupVillage?: string | null;
  courier?: string | null;
  status?: string;
  payment?: string;
  subtotal?: number;
  delivery?: number;
  total: number;
  items?: PrintableOrderItem[];
  note?: string | null;
  createdAt?: string | Date;
};

type PrintMode = "nota" | "stiker";

function PrintSheet({ order, mode, sellerName }: { order: PrintableOrder; mode: PrintMode; sellerName?: string }) {
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString("id-ID") : new Date().toLocaleString("id-ID");
  const items = order.items || [];
  return <div className={`print-sheet print-sheet-${mode}`}>
    <div className="print-brand"><span className="print-brand-mark">P</span><strong>PASARKU</strong><span>{mode === "stiker" ? "LABEL PENGANTARAN" : "NOTA PESANAN"}</span></div>
    <div className="print-order-code">#{order.id}</div>
    {mode === "stiker" ? <>
      <div className="print-sticker-status">{order.status || "Pesanan"} · {order.payment || "COD"}</div>
      <div className="print-address-block"><small>ANTAR KEPADA</small><strong>{order.customer}</strong><span>+{order.whatsapp || "-"}</span><p>{order.address || "Alamat belum tersedia"}<br />Desa {order.village || "Sawahan"}, Kecamatan Sawahan</p></div>
      {order.currentLocation && <div className="print-location">Lokasi terkini pembeli: {order.currentLocation}</div>}
      <div className="print-route-block"><div><small>AMBIL DARI</small><strong>{order.pickupShopName || sellerName || "Mitra PASARKU"}</strong><span>{order.pickupVillage || "Sawahan"}</span></div><div><small>KURIR</small><strong>{order.courier || "Belum ditugaskan"}</strong></div></div>
      <div className="print-cod-box"><span>Total COD</span><strong>{formatRupiah(order.total)}</strong></div>
      {order.note && <p className="print-note">Catatan: {order.note}</p>}
    </> : <>
      <div className="print-meta"><span>Dibuat<br /><strong>{createdAt}</strong></span><span>Status<br /><strong>{order.status || "Menunggu"}</strong></span><span>Pembayaran<br /><strong>{order.payment || "COD"}</strong></span></div>
      <div className="print-address-block"><small>PEMBELI</small><strong>{order.customer}</strong><span>+{order.whatsapp || "-"}</span><p>{order.address || "Alamat belum tersedia"}<br />Desa {order.village || "Sawahan"}, Kecamatan Sawahan</p></div>
      {sellerName && <div className="print-seller-line">Toko: <strong>{sellerName}</strong></div>}
      <div className="print-items">{items.length ? items.map((item, index) => <div className="print-item" key={`${item.name}-${index}`}><span>{item.name}<small>{item.quantity} × {formatRupiah(item.price)}</small></span><strong>{formatRupiah(item.price * item.quantity)}</strong></div>) : <div className="print-item"><span>Pesanan {order.id}<small>{order.items?.length || 1} item</small></span><strong>{formatRupiah(order.total)}</strong></div>}</div>
      <div className="print-totals"><div><span>Subtotal</span><strong>{formatRupiah(order.subtotal ?? order.total)}</strong></div><div><span>Ongkir</span><strong>{formatRupiah(order.delivery ?? 0)}</strong></div><div className="print-total"><span>Total COD</span><strong>{formatRupiah(order.total)}</strong></div></div>
      {order.note && <p className="print-note">Catatan: {order.note}</p>}
    </>}
    <div className="print-footer">PASARKU · Kecamatan Sawahan, Nganjuk · Simpan nota ini untuk operasional pesanan</div>
  </div>;
}

export function OrderPrintActions({ order, sellerName, compact = false }: { order: PrintableOrder; sellerName?: string; compact?: boolean }) {
  const [mode, setMode] = useState<PrintMode | null>(null);
  useEffect(() => {
    if (!mode) return;
    const afterPrint = () => setMode(null);
    window.addEventListener("afterprint", afterPrint);
    const timer = window.setTimeout(() => window.print(), 120);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", afterPrint); };
  }, [mode]);
  return <>
    <div className={`print-actions ${compact ? "compact" : ""}`}>
      <button type="button" onClick={() => setMode("nota")} aria-label={`Cetak nota ${order.id}`}><Printer size={compact ? 14 : 15} /> <span>Nota</span></button>
      <button type="button" onClick={() => setMode("stiker")} aria-label={`Cetak stiker ${order.id}`}><Tag size={compact ? 14 : 15} /> <span>Stiker</span></button>
    </div>
    {mode && <PrintSheet order={order} mode={mode} sellerName={sellerName} />}
  </>;
}

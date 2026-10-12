import { Check, ChevronRight, Clock3, Copy, Download, MapPin, MessageCircle, PackageCheck, ShoppingBag, Truck, XCircle } from "lucide-react";
import { Link, useRoute } from "wouter";
import { useState } from "react";
import { formatRupiah } from "@/data/catalog";
import type { CartItem } from "@/contexts/CartContext";
import { toast } from "sonner";
import { buildAdminWhatsAppLink } from "@/lib/whatsapp";
import { trpc } from "@/lib/trpc";

type StoredOrder = {
  id: string;
  customer: string;
  whatsapp: string;
  village: string;
  address: string;
  currentLocation?: string | null;
  pickupLocation?: string | null;
  routeDistanceKm?: number | null;
  note: string;
  items: CartItem[];
  subtotal: number;
  handlingFee: number;
  delivery: number;
  total: number;
  payment: string;
  createdAt: string;
  status?: string;
};

function readOrder(orderId: string | undefined): StoredOrder | null {
  if (!orderId) return null;
  const raw = window.sessionStorage.getItem(`pasarku_order_${orderId}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredOrder; } catch { return null; }
}

function escapeInvoiceText(value: string | number | null | undefined) {
  return String(value ?? "-").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

function buildInvoiceHtml(order: StoredOrder, formattedDate: string) {
  const items = order.items.map((item) => `<tr><td>${escapeInvoiceText(item.name)}<small>${item.quantity} × ${escapeInvoiceText(formatRupiah(item.price))}</small></td><td>${escapeInvoiceText(formatRupiah(item.price * item.quantity))}</td></tr>`).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice PASARKU #${escapeInvoiceText(order.id)}</title><style>body{margin:0;background:#fffaf5;color:#242321;font:14px Arial,sans-serif}.invoice{max-width:680px;margin:0 auto;padding:28px 20px}.head{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #ff5a00;padding-bottom:18px}.brand{color:#e54800;font-size:24px;font-weight:800}.muted{color:#77736d;font-size:12px;line-height:1.55}.code{text-align:right}.section{padding:18px 0;border-bottom:1px solid #eadfd5}.section h2{margin:0 0 10px;color:#e54800;font-size:14px}.customer strong,.customer span{display:block;margin:3px 0}.items{width:100%;border-collapse:collapse}.items td{padding:10px 0;border-bottom:1px solid #f0e7df;vertical-align:top}.items td:last-child{text-align:right;font-weight:700;white-space:nowrap}.items small{display:block;color:#77736d;margin-top:4px}.totals{margin-left:auto;max-width:280px;padding-top:12px}.totals div{display:flex;justify-content:space-between;gap:20px;padding:5px 0}.totals .grand{margin-top:6px;padding-top:12px;border-top:2px solid #ff5a00;color:#e54800;font-size:18px;font-weight:800}.footer{padding-top:20px;color:#77736d;font-size:11px;line-height:1.6}@media(max-width:480px){.invoice{padding:20px 14px}.head{display:block}.code{text-align:left;margin-top:12px}.brand{font-size:21px}}</style></head><body><main class="invoice"><header class="head"><div><div class="brand">PASARKU</div><div class="muted">Marketplace lokal Kecamatan Sawahan, Nganjuk</div></div><div class="code"><strong>INVOICE</strong><div class="muted">#${escapeInvoiceText(order.id)}<br>${escapeInvoiceText(formattedDate)}</div></div></header><section class="section customer"><h2>Data penerima</h2><strong>${escapeInvoiceText(order.customer)}</strong><span>${escapeInvoiceText(order.whatsapp)}</span><span>${escapeInvoiceText(order.address)}</span><span>Desa ${escapeInvoiceText(order.village)}, Kecamatan Sawahan</span>${order.note ? `<span class="muted">Catatan: ${escapeInvoiceText(order.note)}</span>` : ""}</section><section class="section"><h2>Rincian produk</h2><table class="items"><tbody>${items || `<tr><td>Pesanan ${escapeInvoiceText(order.id)}</td><td>${escapeInvoiceText(formatRupiah(order.total))}</td></tr>`}</tbody></table><div class="totals"><div><span>Subtotal</span><strong>${escapeInvoiceText(formatRupiah(order.subtotal))}</strong></div><div><span>Ongkir</span><strong>${escapeInvoiceText(formatRupiah(order.delivery))}</strong></div><div><span>Biaya penanganan</span><strong>${escapeInvoiceText(formatRupiah(order.handlingFee))}</strong></div><div class="grand"><span>Total COD</span><strong>${escapeInvoiceText(formatRupiah(order.total))}</strong></div></div></section><footer class="footer">Pembayaran: ${escapeInvoiceText(order.payment)}<br>Status: ${escapeInvoiceText(order.status || "Menunggu")}. Simpan invoice ini untuk referensi pesanan.</footer></main></body></html>`;
}

export default function OrderSummary() {
  const [, params] = useRoute("/pesanan/:id");
  const remote = trpc.marketplace.order.useQuery({ orderCode: params?.id || "" }, { enabled: Boolean(params?.id), refetchInterval: 10000 });
  const cancelOrder = trpc.marketplace.cancelOrder.useMutation();
  const shippingSettings = trpc.marketplace.shippingSettings.useQuery();
  const localOrder = readOrder(params?.id);
  const remoteOrder: StoredOrder | null = remote.data ? { id: remote.data.orderCode, customer: remote.data.customerName, whatsapp: remote.data.whatsapp, village: remote.data.village, address: remote.data.address, currentLocation: remote.data.currentLocation, pickupLocation: remote.data.pickupLocation, routeDistanceKm: remote.data.routeDistanceKm ? remote.data.routeDistanceKm / 10 : null, note: remote.data.note || "", items: remote.data.items.map((item) => ({ id: String(item.id), name: item.productName, vendor: "Mitra PASARKU", category: "Produk lokal", price: item.price, quantity: item.quantity, unit: "", accent: "sunset", emoji: "🛍️", description: "", location: "Sawahan", eta: "30–45 menit" })), subtotal: remote.data.subtotal, handlingFee: remote.data.handlingFee ?? 0, delivery: remote.data.delivery, total: remote.data.total, payment: remote.data.payment, createdAt: new Date(remote.data.createdAt).toISOString(), status: remote.data.status } : null;
  const order = remoteOrder || localOrder;
  const [copied, setCopied] = useState(false);
  if (!order && remote.isLoading) return <div className="app-shell"><main className="order-empty"><div className="empty-icon"><Clock3 size={24} /></div><h1>Memuat nota...</h1><p>Mengambil pesanan dari server PASARKU.</p></main></div>;
  if (!order) return <div className="app-shell"><header className="site-header"><div className="container-wide header-inner"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link></div></header><main className="order-empty"><div className="empty-icon"><ShoppingBag size={24} /></div><h1>Nota tidak ditemukan</h1><p>Nota ini tersimpan sementara di browser yang digunakan saat checkout.</p><Link href="/" className="primary-button">Kembali ke katalog</Link></main></div>;
  const copyId = async () => { await navigator.clipboard?.writeText(`#${order.id}`); setCopied(true); toast.success("ID pesanan disalin"); window.setTimeout(() => setCopied(false), 1800); };
  const formattedDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt));
  const downloadInvoice = () => {
    const blob = new Blob([buildInvoiceHtml(order, formattedDate)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-pasarku-${order.id}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Invoice siap diunduh", { description: "Buka folder Unduhan di smartphone untuk melihat file." });
  };
  const canCancel = Boolean(remoteOrder && order.status !== "Selesai" && order.status !== "Dibatalkan" && order.status !== "Diantar");
  const cancel = () => {
    if (!canCancel || cancelOrder.isPending) return;
    if (!window.confirm("Batalkan pesanan ini? Tindakan ini akan mengembalikan stok bila pesanan sudah dikonfirmasi.")) return;
    cancelOrder.mutate({ orderCode: order.id, whatsapp: order.whatsapp }, {
      onSuccess: (updated) => {
        const stored = window.sessionStorage.getItem(`pasarku_order_${order.id}`);
        if (stored) { try { window.sessionStorage.setItem(`pasarku_order_${order.id}`, JSON.stringify({ ...JSON.parse(stored), status: updated?.status ?? "Dibatalkan" })); } catch {} }
        void remote.refetch();
        toast.success("Pesanan berhasil dibatalkan", { description: "Penjual dan Admin PASARKU akan menerima pemberitahuan." });
      },
      onError: (error) => toast.error("Pesanan belum dapat dibatalkan", { description: error.message }),
    });
  };
  return <div className="app-shell"><header className="site-header"><div className="container-wide header-inner"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><div className="header-status"><span className="live-dot"></span> Pesanan tersimpan</div><Link href="/" className="icon-button" aria-label="Kembali ke katalog"><ShoppingBag size={18} /></Link></div></header><main className="order-main"><div className="container-wide"><div className="order-success"><div className="success-check"><Check size={25} /></div><div><div className="eyebrow">Pesanan berhasil dibuat</div><h1>Terima kasih, {order.customer.split(" ")[0]}.</h1><p>Admin PASARKU akan menghubungi Anda via WhatsApp untuk konfirmasi pesanan dan ketersediaan barang.</p></div></div><div className="order-layout"><section className="order-card"><div className="order-card-heading"><div><span className="eyebrow">Nota Pesanan Digital</span><h2>#{order.id}</h2><span className="order-time">Dibuat {formattedDate}</span></div><div className="order-heading-actions"><button className="copy-id" onClick={copyId}><Copy size={14} /> {copied ? "Tersalin" : "Salin ID"}</button><button className="copy-id invoice-download-button" onClick={downloadInvoice}><Download size={14} /> Unduh invoice</button></div></div><div className="order-timeline"><div className="timeline-step active"><span><Check size={14} /></span><div><strong>Pesanan diterima</strong><small>Admin sudah menerima pesanan Anda</small></div></div><div className="timeline-line"></div><div className="timeline-step"><span><Clock3 size={14} /></span><div><strong>Menunggu konfirmasi admin</strong><small>Admin akan menghubungi via WhatsApp</small></div></div><div className="timeline-line"></div><div className="timeline-step muted"><span><Truck size={14} /></span><div><strong>Diantar oleh kurir lokal</strong><small>Estimasi 30–45 menit setelah dikonfirmasi</small></div></div></div><div className="order-block"><div className="block-title"><PackageCheck size={16} /> Rincian barang</div>{order.items.map((item) => <div className="order-item" key={item.id}><div className={`order-item-thumb ${item.accent}`}>{item.emoji}</div><div><strong>{item.name}</strong><small>{item.vendor} · {item.quantity} × {formatRupiah(item.price)}</small></div><b>{formatRupiah(item.price * item.quantity)}</b></div>)}</div><div className="order-total"><div><span>Subtotal</span><strong>{formatRupiah(order.subtotal)}</strong></div><div><span>Biaya penanganan</span><strong>{formatRupiah(order.handlingFee)}</strong></div><div><span>Antar lokal</span><strong>{formatRupiah(order.delivery)}</strong></div><div className="total-row"><span>Total dibayar (COD)</span><strong>{formatRupiah(order.total)}</strong></div></div></section><aside className="order-side"><section className="side-detail"><div className="block-title"><MapPin size={16} /> Alamat pengantaran</div><strong>{order.customer}</strong><span>{order.whatsapp}</span><p>{order.address}<br />Desa {order.village}, Kecamatan Sawahan</p>{order.currentLocation && <div className="address-note">Lokasi terkini pembeli: {order.currentLocation}</div>}{order.pickupLocation && <div className="address-note">Lokasi pickup toko: {order.pickupLocation}{order.routeDistanceKm ? ` · ${order.routeDistanceKm.toFixed(1)} km` : ""}</div>}{order.note && <div className="address-note">Catatan: {order.note}</div>}</section><section className="side-detail"><div className="block-title"><MessageCircle size={16} /> Bantuan pesanan</div><p>Jika ada perubahan alamat atau pesanan, sampaikan ke admin saat dihubungi melalui WhatsApp.</p><a className="outline-button" href={buildAdminWhatsAppLink(order.id, order.customer, shippingSettings.data?.adminWhatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Hubungi admin via WhatsApp</a></section><div className="order-preview-note"><span>✦</span><p>Nota pesanan digital PASARKU. Data pesanan tersimpan di sistem dan dapat diperiksa kembali.</p></div></aside></div><div className="order-footer-actions"><Link href="/" className="text-link dark-link">Kembali belanja <ChevronRight size={15} /></Link>{canCancel && <button type="button" className="order-cancel-button" onClick={cancel} disabled={cancelOrder.isPending}><XCircle size={15} /> {cancelOrder.isPending ? "Membatalkan..." : "Batalkan pesanan"}</button>}{order.status === "Dibatalkan" && <span className="order-cancelled-label"><XCircle size={15} /> Pesanan dibatalkan</span>}</div></div></main></div>;
}

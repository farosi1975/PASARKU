import { Check, ChevronRight, Clock3, Copy, MapPin, MessageCircle, PackageCheck, ShoppingBag, Truck } from "lucide-react";
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

export default function OrderSummary() {
  const [, params] = useRoute("/pesanan/:id");
  const remote = trpc.marketplace.order.useQuery({ orderCode: params?.id || "" }, { enabled: Boolean(params?.id), refetchInterval: 10000 });
  const localOrder = readOrder(params?.id);
  const remoteOrder: StoredOrder | null = remote.data ? { id: remote.data.orderCode, customer: remote.data.customerName, whatsapp: remote.data.whatsapp, village: remote.data.village, address: remote.data.address, currentLocation: remote.data.currentLocation, pickupLocation: remote.data.pickupLocation, routeDistanceKm: remote.data.routeDistanceKm ? remote.data.routeDistanceKm / 10 : null, note: remote.data.note || "", items: remote.data.items.map((item) => ({ id: String(item.id), name: item.productName, vendor: "Mitra PASARKU", category: "Produk lokal", price: item.price, quantity: item.quantity, unit: "", accent: "sunset", emoji: "🛍️", description: "", location: "Sawahan", eta: "30–45 menit" })), subtotal: remote.data.subtotal, delivery: remote.data.delivery, total: remote.data.total, payment: remote.data.payment, createdAt: new Date(remote.data.createdAt).toISOString(), status: remote.data.status } : null;
  const order = localOrder || remoteOrder;
  const [copied, setCopied] = useState(false);
  if (!order && remote.isLoading) return <div className="app-shell"><main className="order-empty"><div className="empty-icon"><Clock3 size={24} /></div><h1>Memuat nota...</h1><p>Mengambil pesanan dari server PASARKU.</p></main></div>;
  if (!order) return <div className="app-shell"><header className="site-header"><div className="container-wide header-inner"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link></div></header><main className="order-empty"><div className="empty-icon"><ShoppingBag size={24} /></div><h1>Nota tidak ditemukan</h1><p>Nota ini tersimpan sementara di browser yang digunakan saat checkout.</p><Link href="/" className="primary-button">Kembali ke katalog</Link></main></div>;
  const copyId = async () => { await navigator.clipboard?.writeText(`#${order.id}`); setCopied(true); toast.success("ID pesanan disalin"); window.setTimeout(() => setCopied(false), 1800); };
  const formattedDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt));
  return <div className="app-shell"><header className="site-header"><div className="container-wide header-inner"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><div className="header-status"><span className="live-dot"></span> Pesanan tersimpan</div><Link href="/" className="icon-button" aria-label="Kembali ke katalog"><ShoppingBag size={18} /></Link></div></header><main className="order-main"><div className="container-wide"><div className="order-success"><div className="success-check"><Check size={25} /></div><div><div className="eyebrow">Pesanan berhasil dibuat</div><h1>Terima kasih, {order.customer.split(" ")[0]}.</h1><p>Admin PASARKU akan menghubungi Anda via WhatsApp untuk konfirmasi pesanan dan ketersediaan barang.</p></div></div><div className="order-layout"><section className="order-card"><div className="order-card-heading"><div><span className="eyebrow">Nota Pesanan Digital</span><h2>#{order.id}</h2><span className="order-time">Dibuat {formattedDate}</span></div><button className="copy-id" onClick={copyId}><Copy size={14} /> {copied ? "Tersalin" : "Salin ID"}</button></div><div className="order-timeline"><div className="timeline-step active"><span><Check size={14} /></span><div><strong>Pesanan diterima</strong><small>Admin sudah menerima pesanan Anda</small></div></div><div className="timeline-line"></div><div className="timeline-step"><span><Clock3 size={14} /></span><div><strong>Menunggu konfirmasi admin</strong><small>Admin akan menghubungi via WhatsApp</small></div></div><div className="timeline-line"></div><div className="timeline-step muted"><span><Truck size={14} /></span><div><strong>Diantar oleh kurir lokal</strong><small>Estimasi 30–45 menit setelah dikonfirmasi</small></div></div></div><div className="order-block"><div className="block-title"><PackageCheck size={16} /> Rincian barang</div>{order.items.map((item) => <div className="order-item" key={item.id}><div className={`order-item-thumb ${item.accent}`}>{item.emoji}</div><div><strong>{item.name}</strong><small>{item.vendor} · {item.quantity} × {formatRupiah(item.price)}</small></div><b>{formatRupiah(item.price * item.quantity)}</b></div>)}</div><div className="order-total"><div><span>Subtotal</span><strong>{formatRupiah(order.subtotal)}</strong></div><div><span>Antar lokal</span><strong>{formatRupiah(order.delivery)}</strong></div><div className="total-row"><span>Total dibayar (COD)</span><strong>{formatRupiah(order.total)}</strong></div></div></section><aside className="order-side"><section className="side-detail"><div className="block-title"><MapPin size={16} /> Alamat pengantaran</div><strong>{order.customer}</strong><span>{order.whatsapp}</span><p>{order.address}<br />Desa {order.village}, Kecamatan Sawahan</p>{order.currentLocation && <div className="address-note">Lokasi terkini pembeli: {order.currentLocation}</div>}{order.pickupLocation && <div className="address-note">Lokasi pickup toko: {order.pickupLocation}{order.routeDistanceKm ? ` · ${order.routeDistanceKm.toFixed(1)} km` : ""}</div>}{order.note && <div className="address-note">Catatan: {order.note}</div>}</section><section className="side-detail"><div className="block-title"><MessageCircle size={16} /> Bantuan pesanan</div><p>Jika ada perubahan alamat atau pesanan, sampaikan ke admin saat dihubungi melalui WhatsApp.</p><a className="outline-button" href={buildAdminWhatsAppLink(order.id, order.customer)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Hubungi admin via WhatsApp</a></section><div className="order-preview-note"><span>✦</span><p>Nota ini adalah bagian dari pratinjau MVP. Data pesanan tersimpan sementara di browser ini.</p></div></aside></div><div className="order-footer-actions"><Link href="/" className="text-link dark-link">Kembali belanja <ChevronRight size={15} /></Link></div></div></main></div>;
}

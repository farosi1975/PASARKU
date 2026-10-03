import { ArrowLeft, Clock3, MapPin, Package, Phone, ShoppingBag, Store } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { formatRupiah } from "@/data/catalog";
import { trpc } from "@/lib/trpc";

const ADMIN_SESSION_KEY = "pasarku_admin_session";

type AdminSession = { sessionToken: string; admin: { id: number; name: string; whatsapp: string } };

function readAdminSession(): AdminSession | null {
  try { return JSON.parse(window.localStorage.getItem(ADMIN_SESSION_KEY) || "null") as AdminSession | null; } catch { return null; }
}

export default function AdminUserDetail() {
  const { role = "buyer", id = "0" } = useParams<{ role: string; id: string }>();
  const [, navigate] = useLocation();
  const session = readAdminSession();
  const selectedRole = role === "seller" ? "seller" : "buyer";
  const detail = trpc.marketplace.userDetail.useQuery({ sessionToken: session?.sessionToken ?? "", role: selectedRole, id: Number(id) }, { enabled: Boolean(session?.sessionToken) });

  if (!session) return <div className="admin-detail-gate"><ShieldMessage /><h1>Sesi Admin diperlukan</h1><p>Halaman detail user hanya dapat dibuka oleh Admin terverifikasi.</p><Link href="/admin" className="primary-button">Masuk ke panel Admin</Link></div>;
  if (detail.isLoading) return <div className="admin-detail-gate"><div className="eyebrow">PASARKU · Admin</div><h1>Memuat detail user...</h1></div>;
  if (detail.isError || !detail.data) return <div className="admin-detail-gate"><div className="eyebrow">Data tidak ditemukan</div><h1>User belum tersedia.</h1><button className="primary-button" onClick={() => navigate("/admin")}>Kembali ke panel</button></div>;

  const data = detail.data;
  const isBuyer = data.role === "buyer";
  return <div className="admin-detail-page"><header className="admin-detail-header"><button className="back-link-button" onClick={() => navigate("/admin")}><ArrowLeft size={16} /> Kembali ke Admin</button><div className="eyebrow">Detail user · Admin terverifikasi</div></header><main className="admin-detail-main"><section className="admin-detail-hero"><div className="admin-detail-avatar">{isBuyer ? data.profile.name.charAt(0).toUpperCase() : data.profile.shopName.charAt(0).toUpperCase()}</div><div><span className="eyebrow">{isBuyer ? "Pembeli" : "Penjual"}</span><h1>{isBuyer ? data.profile.name : data.profile.shopName}</h1><p>{isBuyer ? data.profile.name : data.profile.ownerName} · +{data.profile.whatsapp}</p><small><MapPin size={13} /> {data.profile.village}</small></div></section><div className="admin-detail-stats"><div><strong>{isBuyer ? data.orders.length : data.products.length}</strong><span>{isBuyer ? "Total pesanan" : "Total produk"}</span></div><div><strong>{isBuyer ? formatRupiah(data.orders.reduce((sum, order) => sum + order.total, 0)) : data.profile.shopName}</strong><span>{isBuyer ? "Nilai transaksi" : "Nama toko"}</span></div><div><strong>{isBuyer ? (data.profile.address || "Belum diisi") : `+${data.profile.whatsapp}`}</strong><span>{isBuyer ? "Alamat pengantaran" : "Kontak toko"}</span></div></div><section className="admin-detail-list"><div className="panel-heading"><div><h2>{isBuyer ? "Riwayat pesanan" : "Produk terdaftar"}</h2><p>{isBuyer ? "Semua pesanan yang masuk menggunakan nomor WhatsApp ini." : "Produk yang tercatat di bawah toko ini."}</p></div>{isBuyer ? <ShoppingBag size={19} /> : <Store size={19} />}</div>{isBuyer ? <div className="detail-record-list">{data.orders.length ? data.orders.map((order) => <div className="detail-record" key={order.id}><div className="detail-record-icon"><Package size={17} /></div><div><strong>{order.orderCode}</strong><small><Clock3 size={12} /> {new Date(order.createdAt).toLocaleString("id-ID")} · {order.status}</small><small>{order.village} · {order.address}</small></div><b>{formatRupiah(order.total)}</b></div>) : <div className="detail-empty">Belum ada pesanan dari pembeli ini.</div>}</div> : <div className="detail-record-list">{data.products.length ? data.products.map((product) => <div className="detail-record" key={product.id}><div className="detail-record-icon"><Store size={17} /></div><div><strong>{product.name}</strong><small>{product.category} · Stok {product.stock} · {product.status}</small><small>{product.location}</small></div><b>{formatRupiah(product.price)}</b></div>) : <div className="detail-empty">Belum ada produk dari penjual ini.</div>}</div>}</section></main></div>;
}

function ShieldMessage() { return <div className="admin-detail-shield"><Phone size={20} /></div>; }

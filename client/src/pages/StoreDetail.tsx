import { ArrowLeft, ArrowRight, Check, Clock3, MapPin, MessageCircle, Plus, ShoppingBag, Store, Truck } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { formatRupiah, type Product } from "@/data/catalog";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";

type StoreData = {
  id: number;
  shopName: string;
  ownerName: string;
  whatsapp?: string;
  village: string;
  address?: string | null;
  currentLocation?: string | null;
  avatarUrl?: string | null;
  openingTime: string;
  closingTime: string;
  isOpen: boolean;
  withinSchedule: boolean;
  freeShipping: boolean;
  productCount: number;
};

function mapProduct(item: any): Product {
  return { id: String(item.id), sellerId: item.sellerId, name: item.name, vendor: item.vendor, category: item.category, price: item.price, unit: "", accent: "sunset", emoji: "🛍️", description: `${item.name} dari ${item.vendor}.`, location: item.location, eta: "30–45 menit", imageUrl: item.imageUrl, sellerFreeShipping: item.sellerFreeShipping, storeLocation: item.sellerLocation, storeVillage: item.sellerVillage, openingTime: item.openingTime, closingTime: item.closingTime, badge: "Mitra lokal", storeOpen: item.storeOpen };
}

export default function StoreDetail() {
  const [, params] = useRoute("/toko/:id");
  const [, navigate] = useLocation();
  const { addItem } = useCart();
  const storeId = Number(params?.id);
  const detail = trpc.marketplace.storeDetail.useQuery({ sellerId: storeId }, { refetchInterval: 10000, refetchOnWindowFocus: true });
  const store = detail.data?.store as StoreData | undefined;
  const storeProducts = (detail.data?.products || []).map(mapProduct);
  const isOpenNow = Boolean(store?.isOpen && store.withinSchedule);
  const contactStore = () => {
    if (!store?.whatsapp) return toast.error("Nomor WhatsApp toko belum tersedia.");
    const target = store.whatsapp.replace(/\D/g, "");
    const message = `Halo ${store.shopName}, saya ingin bertanya tentang produk yang tersedia di PASARKU.`;
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };
  const addProduct = (product: Product) => { addItem(product); toast.success("Ditambahkan ke keranjang", { description: product.name }); };
  if (detail.isLoading) return <div className="store-detail-shell"><div className="store-detail-loading"><Store size={24} /><h2>Memuat toko...</h2><p>Status toko dan produknya sedang diperbarui.</p></div></div>;
  if (!store) return <div className="store-detail-shell"><div className="store-detail-loading"><Store size={24} /><h2>Toko tidak ditemukan</h2><p>Toko belum terverifikasi atau sudah tidak tersedia.</p><Link href="/" className="primary-button">Kembali ke katalog <ArrowRight size={16} /></Link></div></div>;
  const mapUrl = store.currentLocation ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.currentLocation)}` : null;
  return <div className="app-shell store-detail-shell"><header className="site-header"><div className="container-wide header-inner"><Link href="/" className="brand" aria-label="Kembali ke PASARKU"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><Link href="/" className="icon-button" aria-label="Kembali ke katalog"><ShoppingBag size={18} /></Link></div></header><main className="store-detail-main"><div className="container-wide"><Link href="/" className="back-link"><ArrowLeft size={16} /> Kembali ke katalog</Link><section className={`store-profile-hero ${isOpenNow ? "store-is-open" : "store-is-closed"}`}><div className="store-profile-avatar">{store.avatarUrl ? <img src={store.avatarUrl} alt={`Logo ${store.shopName}`} /> : <Store size={34} />}</div><div className="store-profile-copy"><div className="eyebrow">Toko mitra PASARKU</div><h1>{store.shopName}</h1><p>Pemilik: {store.ownerName}</p><div className="store-profile-status"><span className={isOpenNow ? "store-live-dot" : "store-closed-dot"}>{isOpenNow ? "Buka sekarang" : "Tutup sementara"}</span><span><MapPin size={14} /> {store.village}</span></div></div><button className="whatsapp-store-button" type="button" onClick={contactStore}><MessageCircle size={17} /> Chat WhatsApp toko</button></section>{!isOpenNow && <div className="store-closed-notice"><Clock3 size={18} /><span><strong>Toko sedang tutup.</strong> Jam layanan: {store.openingTime}–{store.closingTime}. Informasi ini diperbarui otomatis setiap 10 detik.</span></div>}<section className="store-info-grid"><div className="store-info-card"><Clock3 size={19} /><div><small>Jam operasional</small><strong>{store.openingTime}–{store.closingTime}</strong><span>{isOpenNow ? "Buka dan menerima pesanan" : "Tutup di luar jam operasional atau ditutup Penjual"}</span></div></div><div className="store-info-card"><MapPin size={19} /><div><small>Alamat toko</small><strong>{store.address || store.village}</strong>{store.currentLocation && <a href={mapUrl || "#"} target="_blank" rel="noreferrer">Buka lokasi di Google Maps</a>}</div></div><div className="store-info-card"><Truck size={19} /><div><small>Layanan pengantaran</small><strong>{store.freeShipping ? "Gratis ongkir dari toko" : "Antar lokal · COD"}</strong><span>{store.productCount} produk tersedia</span></div></div></section><section className="store-products-section"><div className="section-heading"><div><div className="eyebrow">Etalase toko</div><h2>Produk dari {store.shopName}</h2><p>{isOpenNow ? "Pilih produk yang ingin dimasukkan ke keranjang." : "Produk tetap dapat dilihat; pesanan diproses saat toko kembali buka."}</p></div><span className="store-count">{storeProducts.length} produk</span></div>{storeProducts.length ? <div className="product-grid store-product-grid">{storeProducts.map((product) => <article className="product-card" key={product.id}><div className={`product-visual ${product.accent}`}>{product.imageUrl ? <img className="product-image" src={product.imageUrl} alt={product.name} /> : <span className="product-emoji">{product.emoji}</span>}<span className="product-badge">{isOpenNow ? "Mitra lokal" : "Toko tutup"}</span></div><div className="product-body"><div className="product-category">{product.category}</div><h3 className="product-name">{product.name}</h3><div className="product-vendor"><Check size={13} /> Tersedia dari toko ini</div><div className="product-footer"><strong>{formatRupiah(product.price)}</strong><button className="add-button" disabled={!isOpenNow} onClick={() => addProduct(product)} aria-label={`Tambah ${product.name} ke keranjang`}><Plus size={18} /></button></div></div></article>)}</div> : <div className="empty-results"><Store size={22} /><h3>Produk belum tersedia</h3><p>Silakan hubungi toko melalui WhatsApp untuk menanyakan ketersediaan.</p><button className="outline-button" type="button" onClick={contactStore}><MessageCircle size={16} /> Chat toko</button></div>}</section><button type="button" className="store-bottom-contact" onClick={contactStore}><MessageCircle size={18} /><span><strong>Ada pertanyaan tentang toko?</strong><small>Hubungi {store.shopName} melalui WhatsApp</small></span><ArrowRight size={17} /></button></div></main></div>;
}

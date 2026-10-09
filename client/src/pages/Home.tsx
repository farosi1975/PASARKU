import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Check, ChevronDown, Clock3, MapPin, Minus, PackageCheck, Plus, Search, Settings, ShoppingBag, SlidersHorizontal, Sparkles, Truck, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { categories, formatRupiah, type Product } from "@/data/catalog";
import { useCart } from "@/contexts/CartContext";
import { makeOrderId } from "@/lib/order";
import { calculateShippingCost, DEFAULT_SHIPPING_SETTINGS, distanceBetweenCoordinates, parseCoordinates } from "@shared/shipping";
import { getGoogleDrivingDistanceKm } from "@/lib/google-route";
import { buildAdminWhatsAppLink } from "@/lib/whatsapp";
import { AUTH_EVENT, USER_SESSION_KEY } from "@/lib/auth";
import { LOCATION_OTHER, SAWAHAN_LOCATION_OPTIONS } from "@/lib/locations";
import { trpc } from "@/lib/trpc";
import { HelpAdminButton } from "@/components/HelpAdminButton";

function StoreIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10h18" /><path d="m4 10 1-6h14l1 6" /><path d="M5 10v10h14V10" /><path d="M9 20v-5h6v5" /></svg>;
}

function LogOutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
}

type PromoSlot = { id: string; title: string; description: string; cta: string; color: "orange" | "purple" | "green"; active: boolean; startsAt?: string | Date | null; endsAt?: string | Date | null };

function Header({ onCart, logoUrl, brandName }: { onCart: () => void; logoUrl?: string | null; brandName: string }) {
  const { count } = useCart();
  const [userName, setUserName] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    const loadUser = () => { try {
      const session = JSON.parse(window.localStorage.getItem(USER_SESSION_KEY) || "null") as { name?: string } | null;
      setUserName(session?.name || null);
    } catch {
      setUserName(null);
    } };
    loadUser();
    window.addEventListener(AUTH_EVENT, loadUser);
    return () => window.removeEventListener(AUTH_EVENT, loadUser);
  }, []);
  const logout = () => {
    window.localStorage.removeItem(USER_SESSION_KEY);
    setUserName(null);
    setProfileOpen(false);
    window.dispatchEvent(new Event(AUTH_EVENT));
    toast.success("Anda sudah keluar", { description: "Sesi pengguna di browser ini telah dihapus." });
  };
  return (
    <header className="site-header">
      <div className="container-wide header-inner">
        <Link href="/" className="brand" aria-label={`${brandName} beranda`}>
          {logoUrl ? <img className="brand-logo" src={logoUrl} alt="Logo PASARKU" /> : <span className="brand-mark">P</span>}
          <span>{brandName}</span>
        </Link>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <a href="#jelajahi">Jelajahi</a>
          <a href="#cara-kerja">Cara kerja</a>
          <Link href="/penjual">Jual di PASARKU</Link>
          <HelpAdminButton compact context="pertanyaan dari katalog PASARKU" />
        </nav>
        <div className="header-actions">
          <button className="icon-button cart-trigger" onClick={onCart} aria-label="Buka keranjang">
            <ShoppingBag size={18} />
            {count > 0 && <span className="cart-count">{count}</span>}
          </button>
          {userName ? <div className="profile-menu"><button className="profile-trigger" onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen}><span className="profile-avatar">{userName.charAt(0).toUpperCase()}</span><span className="profile-name">{userName}</span><ChevronDown size={14} /></button>{profileOpen && <div className="profile-dropdown"><div className="profile-dropdown-heading"><span className="profile-avatar large">{userName.charAt(0).toUpperCase()}</span><div><strong>{userName}</strong><small>Pengguna PASARKU</small></div></div><Link href="/profil" className="profile-item" onClick={() => setProfileOpen(false)}><UserRound size={15} /> Profil pengguna</Link><Link href="/profil" className="profile-item" onClick={() => setProfileOpen(false)}><Settings size={15} /> Pengaturan</Link><div className="profile-divider"></div><button className="profile-item danger" onClick={logout}><LogOutIcon /> Keluar</button></div>}</div> : <Link href="/masuk" className="login-button">Masuk</Link>}
        </div>
      </div>
    </header>
  );
}

type OpenStore = { id: number; shopName: string; ownerName: string; village: string; address?: string | null; avatarUrl?: string | null; openingTime: string; closingTime: string; freeShipping: boolean; productCount: number; previewProducts: { id: number; name: string; imageUrl?: string | null; price: number }[] };
function StoreCard({ store, selected, onSelect }: { store: OpenStore; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`open-store-card ${selected ? "selected" : ""}`} onClick={onSelect}><div className="open-store-head">{store.avatarUrl ? <img src={store.avatarUrl} alt="" /> : <span className="open-store-avatar"><StoreIcon /></span>}<div><strong>{store.shopName}</strong><small><MapPin size={12} /> {store.village} · Buka {store.openingTime}–{store.closingTime}</small></div><span className="store-live-dot">Buka</span></div><div className="open-store-preview">{store.previewProducts.map((item) => item.imageUrl ? <img key={item.id} src={item.imageUrl} alt="" /> : <span key={item.id}>{item.name.charAt(0)}</span>)}<div><b>{store.productCount} produk</b><small>{store.freeShipping ? "Gratis ongkir dari toko" : "Antar lokal · COD"}</small></div></div><span className="store-card-action">{selected ? "Produk toko tampil di bawah" : "Lihat produk toko"} <ArrowRight size={15} /></span></button>
}
function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  return (
    <article className="product-card">
      <Link href={`/produk/${product.id}`} className={`product-visual ${product.accent}`} aria-label={`Lihat ${product.name}`}>
        {product.imageUrl ? <img className="product-image" src={product.imageUrl} alt={product.name} /> : <span className="product-emoji">{product.emoji}</span>}
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <span className="visual-arrow"><ArrowRight size={16} /></span>
      </Link>
      <div className="product-body">
        <div className="product-category">{product.category}</div>
        <Link href={`/produk/${product.id}`} className="product-name">{product.name}</Link>
        <div className="product-vendor"><MapPin size={13} /> {product.vendor} · {product.location}</div>
        <div className="product-footer">
          <div><strong>{formatRupiah(product.price)}</strong><span>{product.unit}</span></div>
          <button className="add-button" onClick={() => onAdd(product)} aria-label={`Tambah ${product.name} ke keranjang`}><Plus size={18} /></button>
        </div>
      </div>
    </article>
  );
}

function CartDrawer({ open, onClose, onCheckout }: { open: boolean; onClose: () => void; onCheckout: () => void }) {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const delivery = 0;
  if (!open) return null;
  return (
    <>
      <button className="drawer-scrim" onClick={onClose} aria-label="Tutup keranjang" />
      <aside className="cart-drawer" aria-label="Keranjang belanja">
        <div className="drawer-heading"><div><span className="eyebrow">Pesanan Anda</span><h2>Keranjang</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        {items.length === 0 ? (
          <div className="empty-cart"><div className="empty-icon"><ShoppingBag size={24} /></div><h3>Keranjang masih kosong</h3><p>Temukan kebutuhan warga Sawahan di katalog.</p><button className="primary-button" onClick={onClose}>Mulai belanja</button></div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => <div className="cart-item" key={item.id}><div className={`cart-thumb ${item.accent}`}>{item.emoji}</div><div className="cart-item-main"><strong>{item.name}</strong><span>{formatRupiah(item.price)}{item.unit}</span><div className="quantity-control"><button onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={13} /></button><button className="remove-link" onClick={() => { removeItem(item.id); toast.success(`${item.name} dihapus dari keranjang`); }}><Trash2 size={13} /> Hapus item</button></div></div></div>)}
            </div>
            <div className="cart-summary"><div><span>Subtotal</span><strong>{formatRupiah(subtotal)}</strong></div><div><span>Ongkir</span><strong>Dihitung saat checkout</strong></div><p className="summary-note"><Clock3 size={14} /> Diantar 30–45 menit · Bayar COD</p><button className="primary-button full-width" onClick={onCheckout}>Lanjut ke checkout <ArrowRight size={17} /></button></div>
          </>
        )}
      </aside>
    </>
  );
}

function CheckoutModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [, navigate] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const createOrder = trpc.marketplace.createOrder.useMutation();
  const [buyerPhone, setBuyerPhone] = useState("");
  const [form, setForm] = useState({ name: "", whatsapp: "", village: "Sawahan", address: "", note: "" });
  const [customVillage, setCustomVillage] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const buyerProfile = trpc.marketplace.buyerProfile.useQuery({ whatsapp: buyerPhone || "0000000000" }, { enabled: buyerPhone.length >= 10 });
  const shippingSettings = trpc.marketplace.shippingSettings.useQuery();
  const storeLocation = items.find((item) => item.storeLocation)?.storeLocation || null;
  const storeOrigin = parseCoordinates(storeLocation);
  useEffect(() => {
    let cancelled = false;
    const origin = storeOrigin;
    const destination = parseCoordinates(currentLocation);
    if (!origin || !destination) { setRouteDistanceKm(null); return; }
    getGoogleDrivingDistanceKm(origin, destination).then((distance) => { if (!cancelled) setRouteDistanceKm(distance); }).catch(() => { if (!cancelled) setRouteDistanceKm(null); });
    return () => { cancelled = true; };
  }, [currentLocation, storeLocation]);
  useEffect(() => {
    const loadBuyer = () => {
      try {
        const session = JSON.parse(window.localStorage.getItem(USER_SESSION_KEY) || "null") as { name?: string; phone?: string } | null;
        const phone = session?.phone || "";
        setBuyerPhone(phone);
        if (session) setForm((current) => ({ ...current, name: current.name || session.name || "", whatsapp: current.whatsapp || phone }));
      } catch {
        setBuyerPhone("");
      }
    };
    loadBuyer();
    window.addEventListener(AUTH_EVENT, loadBuyer);
    return () => window.removeEventListener(AUTH_EVENT, loadBuyer);
  }, []);
  useEffect(() => {
    const profile = buyerProfile.data;
    if (open && profile) setForm((current) => ({ ...current, name: profile.name, whatsapp: profile.whatsapp, village: profile.village, address: profile.address || "" }));
  }, [buyerProfile.data, open]);
  if (!open) return null;
  const hasFreeShipping = items.length > 0 && items.every((item) => item.sellerFreeShipping === true);
  const shipping = shippingSettings.data || DEFAULT_SHIPPING_SETTINGS;
  const delivery = calculateShippingCost(shipping, currentLocation, hasFreeShipping, routeDistanceKm);
  const buyerCoordinates = parseCoordinates(currentLocation);
  const distanceKm = routeDistanceKm || (storeOrigin && buyerCoordinates ? distanceBetweenCoordinates(storeOrigin, buyerCoordinates) : 1);
  const handlingFee = Math.round(subtotal * (shipping.handlingFeePercent || 0) / 100);
  const total = subtotal + handlingFee + delivery;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.whatsapp || !form.address) return toast.error("Lengkapi nama, WhatsApp, dan alamat terlebih dahulu.");
    const village = form.village === LOCATION_OTHER ? customVillage.trim() : form.village;
    if (village.length < 2) return toast.error("Tuliskan nama kecamatan atau wilayah tujuan.");
    const localOrderId = makeOrderId();
    let orderId = localOrderId;
    try {
      const synced = await createOrder.mutateAsync({ customerName: form.name, whatsapp: form.whatsapp, village, address: form.address, currentLocation: currentLocation || undefined, pickupLocation: storeLocation || undefined, routeDistanceKm: routeDistanceKm || undefined, handlingFee, note: form.note, subtotal, delivery, total, payment: "COD", items: items.map((item) => ({ productId: /^\d+$/.test(item.id) ? Number(item.id) : undefined, productName: item.name, price: item.price, quantity: item.quantity })) });
      orderId = synced?.orderCode || localOrderId;
    } catch (error) {
      toast.warning("Pesanan tersimpan di preview lokal", { description: error instanceof Error ? error.message : "Database belum merespons." });
    }
    const order = { id: orderId, customer: form.name, whatsapp: form.whatsapp, village, address: form.address, currentLocation: currentLocation || null, pickupLocation: storeLocation || null, routeDistanceKm, note: form.note, items, subtotal, handlingFee, delivery, total, payment: "COD", createdAt: new Date().toISOString() };
    window.sessionStorage.setItem(`pasarku_order_${orderId}`, JSON.stringify(order));
    clearCart();
    onDone();
    toast.success("Pesanan berhasil dibuat.", { description: "Admin PASARKU akan menghubungi Anda via WhatsApp untuk konfirmasi.", action: { label: "Hubungi WA", onClick: () => window.open(buildAdminWhatsAppLink(orderId, form.name, shippingSettings.data?.adminWhatsapp), "_blank", "noopener,noreferrer") } });
    window.setTimeout(() => navigate(`/pesanan/${orderId}`), 300);
  };
  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const useCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error("Perangkat ini tidak mendukung lokasi terkini.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => { const value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`; setCurrentLocation(value); setLocating(false); toast.success("Lokasi terkini berhasil ditambahkan", { description: "Kurir akan melihat titik lokasi ini bersama alamat terdaftar." }); }, () => { setLocating(false); toast.error("Lokasi belum dapat diakses", { description: "Izinkan akses lokasi di browser atau gunakan alamat terdaftar." }); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };
  return <div className="checkout-backdrop"><div className="checkout-modal"><div className="drawer-heading"><div><span className="eyebrow">Langkah terakhir</span><h2>Checkout COD</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div><form onSubmit={submit} className="checkout-form"><div className="profile-sync-note"><UserRound size={15} /> {buyerProfile.data ? "Data profil tersimpan otomatis." : "Lengkapi data ini agar Admin dapat menghubungi Anda."}</div><div className="form-grid"><label>Nama penerima<input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Contoh: Sari Wulandari" /></label><label>No. WhatsApp<input value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} placeholder="08xxxxxxxxxx" /></label></div><label>Desa / wilayah<select value={form.village} onChange={(e) => setField("village", e.target.value)}>{SAWAHAN_LOCATION_OPTIONS.map((village) => <option key={village}>{village}</option>)}</select>{form.village === LOCATION_OTHER && <input value={customVillage} onChange={(event) => setCustomVillage(event.target.value)} placeholder="Tulis kecamatan/wilayah sendiri" maxLength={80} />}</label><label>Alamat lengkap<input value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Dusun, RT/RW, patokan rumah" /></label><div className="current-location-box"><div><strong>Lokasi pengantaran</strong><small>{currentLocation ? `Lokasi terkini tersimpan: ${currentLocation}` : "Gunakan lokasi terkini bila Anda sedang di luar alamat terdaftar."}</small></div><button className="outline-button" type="button" onClick={useCurrentLocation} disabled={locating}><MapPin size={15} /> {locating ? "Mencari..." : currentLocation ? "Perbarui lokasi" : "Gunakan lokasi terkini"}</button></div><label>Catatan untuk kurir <span className="optional">opsional</span><textarea value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Contoh: titip di warung depan rumah" rows={3} /></label><div className="payment-choice"><div className="payment-icon">▣</div><div><strong>Bayar di tempat (COD)</strong><span>Kurir membawa nota digital dan menagih saat barang sampai.</span></div><Check size={18} /></div><div className="checkout-shipping-summary"><div><span>{routeDistanceKm ? "Jarak rute Google Maps" : currentLocation ? "Jarak estimasi" : "Jarak minimum"}</span><strong>{distanceKm.toFixed(1)} km</strong></div><div><span>Ongkir {hasFreeShipping ? "(gratis dari toko)" : shipping.discountPercent ? `(diskon ${shipping.discountPercent}%)` : ""}</span><strong>{hasFreeShipping ? "Gratis" : formatRupiah(delivery)}</strong></div><div><span>Biaya penanganan {shipping.handlingFeePercent ? `(${shipping.handlingFeePercent}%)` : ""}</span><strong>{formatRupiah(handlingFee)}</strong></div></div><div className="checkout-total"><span>Total yang dibayar</span><strong>{formatRupiah(total)}</strong></div><button className="primary-button full-width" type="submit">Buat pesanan <ArrowRight size={17} /></button><p className="fine-print">Setelah dibuat, Admin PASARKU dapat dihubungi via WhatsApp untuk konfirmasi.</p></form></div></div>;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [activeVillage, setActiveVillage] = useState("Semua desa");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { addItem } = useCart();
  const syncedProducts = trpc.marketplace.products.useQuery(undefined, { refetchInterval: 15000 });
  const openStores = trpc.marketplace.openStores.useQuery(undefined, { refetchInterval: 15000 });
  const siteSettings = trpc.marketplace.siteSettings.useQuery(undefined, { refetchInterval: 30000 });
  const catalogProducts = useMemo(() => (syncedProducts.data || []).map((item) => ({ id: String(item.id), sellerId: item.sellerId ?? undefined, name: item.name, vendor: item.vendor, category: item.category, price: item.price, unit: "", accent: "sunset", emoji: "🛍️", imageUrl: item.imageUrl, sellerFreeShipping: item.sellerFreeShipping, storeLocation: item.sellerLocation, storeVillage: item.sellerVillage, openingTime: item.openingTime, closingTime: item.closingTime, description: `${item.name} dari ${item.vendor}.`, location: item.location, eta: "30–45 menit", badge: "Mitra lokal", storeOpen: true } satisfies Product)), [syncedProducts.data]);
  const villages = useMemo(() => ["Semua desa", ...Array.from(new Set(catalogProducts.map((product) => product.storeVillage || product.location.split(" · ")[0])).values()).sort()], [catalogProducts]);
  const normalizeFilterValue = (value: string | null | undefined) => (value || "").trim().toLocaleLowerCase("id-ID");
  const visibleProducts = useMemo(() => catalogProducts.filter((product) => (selectedStoreId === null || product.sellerId === selectedStoreId) && (normalizeFilterValue(activeCategory) === normalizeFilterValue("Semua") || normalizeFilterValue(product.category) === normalizeFilterValue(activeCategory)) && (normalizeFilterValue(activeVillage) === normalizeFilterValue("Semua desa") || normalizeFilterValue(product.storeVillage || product.location.split(" · ")[0]) === normalizeFilterValue(activeVillage)) && `${product.name} ${product.vendor}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"))), [activeCategory, activeVillage, catalogProducts, search, selectedStoreId]);
  const hasActiveFilter = activeCategory !== "Semua" || activeVillage !== "Semua desa" || search.trim().length > 0;
  const site = siteSettings.data ?? { brandName: "PASARKU", tagline: "Marketplace warga Sawahan", heroTitle: "Belanja dekat,", heroHighlight: "berdampak hebat.", heroDescription: "Temukan produk dan jasa dari tetangga sendiri. PASARKU menghubungkan warga dengan UMKM lokal.", promoActive: 1, promoColor: "orange", promoTitle: "Promo warga Sawahan", promoDescription: "Temukan penawaran terbaru dari toko lokal.", promoCta: "Jelajahi sekarang", logoUrl: null, bannerImageUrl: null, promoStartsAt: null, promoEndsAt: null, promoSlots: null, heroBackgroundUrl: null, heroBackgroundColor: "#d45b39", heroOverlayColor: "#7a2f2f", heroOverlayOpacity: 28, heroBackgroundPosition: "center" };
  const now = Date.now();
  const promoInSchedule = (!site.promoStartsAt || new Date(site.promoStartsAt).getTime() <= now) && (!site.promoEndsAt || new Date(site.promoEndsAt).getTime() >= now);
  let promoSlots: PromoSlot[] = [];
  try { promoSlots = site.promoSlots ? JSON.parse(site.promoSlots) : []; } catch { promoSlots = []; }
  if (!promoSlots.length) promoSlots = [{ id: "legacy", title: site.promoTitle, description: site.promoDescription, cta: site.promoCta, color: site.promoColor === "purple" || site.promoColor === "green" ? site.promoColor : "orange", active: Boolean(site.promoActive), startsAt: site.promoStartsAt, endsAt: site.promoEndsAt }];
  const visiblePromoSlots = promoSlots.filter((promo) => { const starts = !promo.startsAt || new Date(promo.startsAt).getTime() <= now; const ends = !promo.endsAt || new Date(promo.endsAt).getTime() >= now; return Boolean(promo.active) && starts && ends; });
  const openCatalogFilters = () => {
    setFiltersOpen((current) => !current);
    window.setTimeout(() => document.getElementById("catalog-filter-controls")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };
  const resetCatalogFilters = () => { setActiveCategory("Semua"); setActiveVillage("Semua desa"); setSearch(""); setSelectedStoreId(null); };
  const addProduct = (product: Product) => { addItem(product); setCartOpen(true); toast.success("Ditambahkan ke keranjang", { description: product.name }); };
  return <div className="app-shell"><Header logoUrl={site.logoUrl} brandName={site.brandName || "PASARKU"} onCart={() => setCartOpen(true)} /><main><section className="hero-section" style={{ backgroundColor: site.heroBackgroundColor || "#d45b39", backgroundImage: site.heroBackgroundUrl ? `url(${site.heroBackgroundUrl})` : undefined, backgroundPosition: site.heroBackgroundPosition || "center", ["--hero-overlay-color" as string]: site.heroOverlayColor || "#7a2f2f", ["--hero-overlay-opacity" as string]: String((site.heroOverlayOpacity ?? 28) / 100) } as React.CSSProperties}><div className="container-wide hero-grid"><div className="hero-copy"><div className="eyebrow eyebrow-light"><Sparkles size={14} /> {site?.tagline || "Marketplace warga Sawahan"}</div><h1>{site?.heroTitle || "Belanja dekat,"}<br /><em>{site?.heroHighlight || "berdampak hebat."}</em></h1><p>{site?.heroDescription || "Temukan produk dan jasa dari tetangga sendiri. PASARKU menghubungkan warga dengan UMKM lokal."}</p><div className="hero-actions"><a href="#jelajahi" className="primary-button light-button">Jelajahi kebutuhan <ArrowRight size={17} /></a><a href="#cara-kerja" className="text-link light-link">Bagaimana cara kerja? <ArrowRight size={15} /></a><Link href="/penjual" className="text-link light-link">Jual sebagai mitra <ArrowRight size={15} /></Link><Link href="/kurir" className="text-link light-link">Daftar sebagai kurir <ArrowRight size={15} /></Link></div><div className="hero-proof"><div className="avatar-stack"><span>R</span><span>B</span><span>S</span><span>+</span></div><div><strong>Untuk warga Sawahan</strong><small>Antar lokal · bayar di tempat</small></div></div></div><div className="hero-visual"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="hero-card hero-card-main"><div className="hero-card-top"><span className="live-dot"></span><span>Pasar hari ini</span><span className="hero-card-location"><MapPin size={13} /> Sawahan</span></div><div className="market-sticker">🧺</div><h3>Semua kebutuhan,<br /><span>dari sekitar kita.</span></h3><div className="hero-mini-row"><div><strong>30–45</strong><small>menit antar</small></div><div><strong>COD</strong><small>bayar di tempat</small></div><div><strong>1 kec.</strong><small>lebih dekat</small></div></div></div><div className="floating-note note-one"><span className="note-icon green">✓</span><div><strong>Kurir lokal aktif</strong><small>Siap mengantar hari ini</small></div></div><div className="floating-note note-two"><span className="note-icon orange">↗</span><div><strong>+ UMKM lokal</strong><small>Makin mudah ditemukan</small></div></div></div></div></section><section className="trust-strip"><div className="container-wide trust-grid"><div><Truck size={18} /><span>Pengiriman satu pintu</span></div><div><PackageCheck size={18} /><span>Produk dari warga sekitar</span></div><div><Check size={18} /><span>COD, sederhana & aman</span></div><div><Clock3 size={18} /><span>Antar hari ini</span></div></div></section>{visiblePromoSlots.map((promo) => <section key={promo.id} className={`promo-strip promo-${promo.color}`} style={site.bannerImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(255,240,231,.96), rgba(255,240,231,.78)), url(${site.bannerImageUrl})` } : undefined}><div className="container-wide promo-inner"><div><span className="eyebrow">{promo.title}</span><h2>{promo.description}</h2></div><a className="primary-button light-button" href="#jelajahi">{promo.cta} <ArrowRight size={16} /></a></div></section>)}<section id="jelajahi" className="catalog-section"><div className="container-wide"><div className="section-heading"><div><div className="eyebrow">Katalog pilihan</div><h2>Butuh apa hari ini?</h2><p>Produk nyata dari penjual PASARKU yang sedang membuka toko.</p></div><button className={`outline-button ${hasActiveFilter || filtersOpen ? "filter-button-active" : ""}`} onClick={openCatalogFilters} aria-expanded={filtersOpen}><SlidersHorizontal size={16} /> {filtersOpen ? "Tutup filter" : hasActiveFilter ? "Filter aktif" : "Filter katalog"}</button></div><div id="catalog-filter-controls" className={`category-row ${filtersOpen ? "filters-open" : ""}`}>{categories.map((category) => <button key={category.label} className={`category-pill ${activeCategory === category.label ? "active" : ""}`} onClick={() => setActiveCategory(category.label)}><span>{category.icon}</span>{category.label}</button>)}<select className="village-filter" value={activeVillage} onChange={(event) => setActiveVillage(event.target.value)} aria-label="Filter desa toko">{villages.map((village) => <option key={village}>{village}</option>)}</select>{hasActiveFilter && <button type="button" className="filter-reset-button" onClick={resetCatalogFilters}>Reset</button>}</div><div className="catalog-tools"><div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk, toko, atau jasa..." /><kbd>/</kbd></div><span className="result-count">{visibleProducts.length} pilihan tersedia <ChevronDown size={15} /></span></div>{syncedProducts.isLoading || openStores.isLoading ? <div className="empty-results"><div className="empty-icon"><Clock3 size={22} /></div><h3>Memuat toko yang buka</h3><p>Sebentar, kami mengambil toko dan produk yang tersedia.</p></div> : <>{openStores.data?.length ? <section className="open-stores-section"><div className="catalog-subheading"><div><span className="eyebrow">80% fokus toko</span><h3>Toko yang sedang buka</h3><p>Klik toko untuk melihat produk yang tersedia.</p></div><span className="store-count">{openStores.data.length} toko buka</span></div><div className="open-store-grid">{(openStores.data as OpenStore[]).filter((store) => activeVillage === "Semua desa" || normalizeFilterValue(store.village) === normalizeFilterValue(activeVillage)).map((store) => <StoreCard key={store.id} store={store} selected={selectedStoreId === store.id} onSelect={() => { setSelectedStoreId((current) => current === store.id ? null : store.id); window.setTimeout(() => document.getElementById("produk-katalog")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} />)}</div></section> : null}<div id="produk-katalog" className="product-catalog-compact"><div className="catalog-subheading"><div><span className="eyebrow">20% katalog produk</span><h3>{selectedStoreId ? "Produk toko pilihan" : "Produk tersedia"}</h3></div>{selectedStoreId && <button className="filter-reset-button" onClick={() => setSelectedStoreId(null)}>Semua toko</button>}</div>{visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={addProduct} />)}</div> : <div className="empty-results"><div className="empty-icon"><StoreIcon /></div><h3>{selectedStoreId ? "Belum ada produk sesuai filter" : "Belum ada toko yang buka"}</h3><p>{selectedStoreId ? "Pilih toko lain atau reset filter katalog." : "Produk penjual yang sudah disetujui akan tampil di sini saat tokonya dibuka."}</p>{!selectedStoreId && <Link href="/penjual" className="text-link">Daftar sebagai penjual <ArrowRight size={15} /></Link>}</div>}</div></>}<div className="catalog-note"><Sparkles size={17} /><span>Katalog ini menampilkan <strong>produk nyata</strong> dari penjual terverifikasi yang sedang membuka toko. Produk akan hilang otomatis saat toko ditutup.</span></div></div></section><section id="cara-kerja" className="how-section"><div className="container-wide"><div className="section-heading centered"><div><div className="eyebrow">Sederhana dari awal</div><h2>Dari pasar lokal, untuk warga lokal.</h2><p>Alur concierge MVP PASARKU dirancang agar mudah dimulai bersama tim kecil.</p></div></div><div className="how-grid"><div className="how-card"><span className="step-number">01</span><div className="how-icon">🧑‍💼</div><h3>Admin kurasi produk</h3><p>Admin mendatangi UMKM, memotret, dan memasukkan produk ke katalog.</p></div><div className="how-card highlighted"><span className="step-number">02</span><div className="how-icon">🛒</div><h3>Warga pesan online</h3><p>Pembeli memilih kebutuhan, mengisi alamat desa, lalu memilih COD.</p></div><div className="how-card"><span className="step-number">03</span><div className="how-icon">🛵</div><h3>Kurir antar ke rumah</h3><p>Pesanan masuk ke dashboard admin, kurir mengambil dan mengantar.</p></div></div></div></section></main><footer className="site-footer"><div className="container-wide footer-inner"><div className="brand"><span className="brand-mark">P</span><span>{site.brandName || "PASARKU"}</span></div><span>Pratinjau MVP · Kecamatan Sawahan, Nganjuk</span><span>© 2026 PASARKU</span></div></footer><CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} /><CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} onDone={() => setCheckoutOpen(false)} /></div>;
}

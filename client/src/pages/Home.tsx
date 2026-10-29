import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Check, ChevronDown, Clock3, MapPin, MessageCircle, Minus, PackageCheck, Plus, RefreshCw, Search, Settings, ShoppingCart, SlidersHorizontal, Sparkles, Truck, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { categories, formatRupiah, type Product } from "@/data/catalog";
import { useCart } from "@/contexts/CartContext";
import { makeOrderId } from "@/lib/order";
import { calculateShippingCost, DEFAULT_SHIPPING_SETTINGS, distanceBetweenCoordinates, parseCoordinates } from "@shared/shipping";
import { getGoogleDrivingDistanceKm } from "@/lib/google-route";
import { buildAdminWhatsAppLink } from "@/lib/whatsapp";
import { AUTH_EVENT, USER_SESSION_KEY } from "@/lib/auth";
import { LOCATION_OTHER, PASARKU_DISTRICT, PASARKU_DISTRICTS, PASARKU_REGENCY, SAWAHAN_LOCATION_OPTIONS, SAWAHAN_VILLAGES } from "@/lib/locations";
import { trpc } from "@/lib/trpc";
import { HelpAdminButton } from "@/components/HelpAdminButton";

function StoreIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10h18" /><path d="m4 10 1-6h14l1 6" /><path d="M5 10v10h14V10" /><path d="M9 20v-5h6v5" /></svg>;
}

function LogOutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
}

type PromoSlot = { id: string; title: string; description: string; cta: string; color: "orange" | "purple" | "green"; active: boolean; startsAt?: string | Date | null; endsAt?: string | Date | null; bannerImageUrl?: string | null };

function Header({ onCart, logoUrl, brandName }: { onCart: () => void; logoUrl?: string | null; brandName: string }) {
  const { count } = useCart();
  const [, navigate] = useLocation();
  const [userName, setUserName] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const previousCartCount = useRef(count);
  useEffect(() => setLogoFailed(false), [logoUrl]);
  useEffect(() => {
    if (count > previousCartCount.current) {
      setCartBump(true);
      const timer = window.setTimeout(() => setCartBump(false), 520);
      previousCartCount.current = count;
      return () => window.clearTimeout(timer);
    }
    previousCartCount.current = count;
    return undefined;
  }, [count]);
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
    window.location.assign("/masuk");
  };
  return (
    <header className="site-header">
      <div className="container-wide header-inner">
        <Link href="/" className="brand" aria-label={`${brandName} beranda`}>
          {logoUrl && !logoFailed ? <img className="brand-logo" src={logoUrl} alt="Logo PASARKU" onError={() => setLogoFailed(true)} /> : <span className="brand-mark">P</span>}
          <span>{brandName}</span>
        </Link>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <a href="#jelajahi">Jelajahi</a>
          <a href="#cara-kerja">Cara kerja</a>
          <Link href="/penjual">Jual di PASARKU</Link>
          <HelpAdminButton compact context="pertanyaan dari katalog PASARKU" />
        </nav>
        <div className="header-actions">
          <button className={`icon-button cart-trigger ${cartBump ? "cart-bump" : ""}`} onClick={onCart} aria-label="Buka keranjang">
            <ShoppingCart size={18} />
            {count > 0 && <span className={`cart-count ${cartBump ? "cart-count-pop" : ""}`} aria-live="polite">{count}</span>}
          </button>
          {userName ? <div className="profile-menu"><button className="profile-trigger" onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen}><span className="profile-avatar">{userName.charAt(0).toUpperCase()}</span><span className="profile-name">{userName}</span><ChevronDown size={14} /></button>{profileOpen && <div className="profile-dropdown"><div className="profile-dropdown-heading"><span className="profile-avatar large">{userName.charAt(0).toUpperCase()}</span><div><strong>{userName}</strong><small>Pengguna PASARKU</small></div></div><Link href="/profil" className="profile-item" onClick={() => setProfileOpen(false)}><UserRound size={15} /> Profil pengguna</Link><Link href="/profil" className="profile-item" onClick={() => setProfileOpen(false)}><Settings size={15} /> Pengaturan</Link><div className="profile-divider"></div><button className="profile-item danger" onClick={logout}><LogOutIcon /> Keluar</button></div>}</div> : <Link href="/masuk" className="login-button">Masuk</Link>}
        </div>
      </div>
    </header>
  );
}

type OpenStore = { id: number; shopName: string; ownerName: string; whatsapp?: string; village: string; district?: string; address?: string | null; avatarUrl?: string | null; openingTime: string; closingTime: string; freeShipping: boolean; productCount: number; previewProducts: { id: number; name: string; imageUrl?: string | null; price: number }[] };
function StoreCard({ store, selected, onSelect, onOpen }: { store: OpenStore; selected: boolean; onSelect: () => void; onOpen: () => void }) {
  return <button type="button" className={`open-store-card ${selected ? "selected" : ""}`} onClick={() => { onSelect(); onOpen(); }}><div className="open-store-head">{store.avatarUrl ? <img src={store.avatarUrl} alt="" /> : <span className="open-store-avatar"><StoreIcon /></span>}<div><strong>{store.shopName}</strong><small><MapPin size={12} /> {store.village} · Buka {store.openingTime}–{store.closingTime}</small></div><span className="store-live-dot">Buka</span></div><div className="open-store-preview">{store.previewProducts.map((item) => item.imageUrl ? <img key={item.id} src={item.imageUrl} alt="" /> : <span key={item.id}>{item.name.charAt(0)}</span>)}<div><b>{store.productCount} produk</b><small>{store.freeShipping ? "Gratis ongkir dari toko" : "Antar lokal · COD"}</small></div></div><span className="store-card-action">Buka detail toko <ArrowRight size={15} /></span></button>
}
function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  const preorderUnavailable = Boolean(product.isPreOrder && product.preOrderActive === false);
  return (
    <article className="product-card">
      <Link href={`/produk/${product.id}`} className={`product-visual ${product.accent}`} aria-label={`Lihat ${product.name}`}>
        {product.imageUrl ? <img className="product-image" src={product.imageUrl} alt={product.name} /> : <span className="product-emoji">{product.emoji}</span>}
        {product.isPreOrder ? <span className="product-badge preorder-badge">Pre-Order · {product.preOrderDays || 1} hari</span> : product.stock === 0 ? <span className="product-badge sold-out-badge">Stok habis</span> : product.stock !== undefined && product.stock <= 5 ? <span className="product-badge low-stock-badge">Stok menipis</span> : product.badge && <span className="product-badge">{product.badge}</span>}
        <span className="visual-arrow"><ArrowRight size={16} /></span>
      </Link>
      <div className="product-body">
        <div className="product-category">{product.isPreOrder ? "Pre-Order" : product.category}</div>
        <Link href={`/produk/${product.id}`} className="product-name">{product.name}</Link>
        <div className="product-vendor"><MapPin size={13} /> {product.vendor} · {product.location}</div>
        <div className="product-footer">
          <div><strong>{formatRupiah(product.price)}</strong><span>{product.unit}</span></div>
          <button className={`add-button ${preorderUnavailable || (!product.isPreOrder && product.stock === 0) ? "disabled" : ""}`} disabled={preorderUnavailable || (!product.isPreOrder && product.stock === 0)} onClick={() => onAdd(product)} aria-label={preorderUnavailable ? `${product.name} Pre-Order tidak tersedia` : !product.isPreOrder && product.stock === 0 ? `${product.name} stok habis` : `Tambah ${product.name} ke keranjang`}>{preorderUnavailable ? "Tutup" : !product.isPreOrder && product.stock === 0 ? "Habis" : <Plus size={18} />}</button>
        </div>
      </div>
    </article>
  );
}

function CartDrawer({ open, onClose, onCheckout }: { open: boolean; onClose: () => void; onCheckout: (mode: "regular" | "preorder" | "all") => void }) {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const hasPreOrder = items.some((item) => item.isPreOrder);
  const hasRegular = items.some((item) => !item.isPreOrder);
  const delivery = 0;
  if (!open) return null;
  return (
    <>
      <button className="drawer-scrim" onClick={onClose} aria-label="Tutup keranjang" />
      <aside className="cart-drawer" aria-label="Keranjang belanja">
        <div className="drawer-heading"><div><span className="eyebrow">Pesanan Anda</span><h2>Keranjang</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>
        {items.length === 0 ? (
          <div className="empty-cart"><div className="empty-icon"><ShoppingCart size={24} /></div><h3>Keranjang masih kosong</h3><p>Temukan kebutuhan warga Sawahan di katalog.</p><button className="primary-button" onClick={onClose}>Mulai belanja</button></div>
        ) : (
          <>
            <div className="cart-items">
              {items.map((item) => <div className={`cart-item ${!item.isPreOrder && item.stock === 0 ? "cart-item-unavailable" : ""}`} key={item.id}><div className={`cart-thumb ${item.accent}`}>{item.emoji}</div><div className="cart-item-main"><strong>{item.name}</strong><span>{formatRupiah(item.price)}{item.unit}</span>{!item.isPreOrder && item.stock === 0 && <small className="stock-warning">Stok habis — hapus dari keranjang</small>}{item.stock !== undefined && item.stock > 0 && item.stock <= 5 && <small className="stock-warning">Stok menipis: tersisa {item.stock}</small>}<div className="quantity-control"><button onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.stock !== undefined && item.quantity >= item.stock}><Plus size={13} /></button><button className="remove-link" onClick={() => { removeItem(item.id); toast.success(`${item.name} dihapus dari keranjang`); }}><Trash2 size={13} /> Hapus item</button></div></div></div>)}
            </div>
            <div className="cart-summary">{items.some((item) => !item.isPreOrder && (item.stock === 0 || (item.stock !== undefined && item.quantity > item.stock))) && <div className="stock-warning cart-checkout-warning">Periksa item bertanda stok habis sebelum checkout.</div>}<div><span>Subtotal</span><strong>{formatRupiah(subtotal)}</strong></div><div><span>Ongkir</span><strong>Dihitung saat checkout</strong></div><p className="summary-note"><Clock3 size={14} /> {hasPreOrder ? "Pre-Order COD tanpa uang muka · maksimal 5 hari" : "Diantar 30–45 menit · Bayar COD"}</p>{hasPreOrder && hasRegular && <div className="cart-checkout-warning">Checkout produk biasa dan Pre-Order dipisah.</div>}{hasRegular && <button className="primary-button full-width" onClick={() => onCheckout(hasPreOrder ? "regular" : "all")}>Checkout produk biasa <ArrowRight size={17} /></button>}{hasPreOrder && <button className="primary-button full-width preorder-checkout-button" onClick={() => onCheckout("preorder")}>Checkout Pre-Order <ArrowRight size={17} /></button>}</div>
          </>
        )}
      </aside>
    </>
  );
}

function CheckoutModal({ open, onClose, onDone, mode }: { open: boolean; onClose: () => void; onDone: () => void; mode: "regular" | "preorder" | "all" }) {
  const [, navigate] = useLocation();
  const { items: cartItems, removeItem, clearCart } = useCart();
  const items = mode === "preorder" ? cartItems.filter((item) => item.isPreOrder) : mode === "regular" ? cartItems.filter((item) => !item.isPreOrder) : cartItems;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const createOrder = trpc.marketplace.createOrder.useMutation();
  const [buyerPhone, setBuyerPhone] = useState("");
  const [guestRegistrationOpen, setGuestRegistrationOpen] = useState(false);
  const [guestReferralCode, setGuestReferralCode] = useState("");
  const [guestRequestCode, setGuestRequestCode] = useState<string | null>(null);
  const [guestRegistrationError, setGuestRegistrationError] = useState<string | null>(null);
  const lastGuestStatusRef = useRef<string | null>(null);
  const guestRegistrationCardRef = useRef<HTMLDivElement | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [form, setForm] = useState({ name: "", whatsapp: "", village: "Sawahan", address: "", note: "" });
  const [customVillage, setCustomVillage] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const buyerProfile = trpc.marketplace.buyerProfile.useQuery({ whatsapp: buyerPhone || "0000000000" }, { enabled: buyerPhone.length >= 10 });
  const createWhatsAppRegistration = trpc.marketplace.createWhatsAppRegistration.useMutation();
  const guestRegistrationStatus = trpc.marketplace.whatsappRegistrationStatus.useQuery({ requestCode: guestRequestCode || "00000000" }, { enabled: Boolean(guestRequestCode), refetchInterval: guestRequestCode ? 3000 : false });
  const shippingSettings = trpc.marketplace.shippingSettings.useQuery();
  const shipping = shippingSettings.data || DEFAULT_SHIPPING_SETTINGS;
  // Backend hanya memakai lokasi pickup bila seluruh item berasal dari satu titik toko.
  // Gunakan aturan yang sama agar ongkir preview identik dengan ongkir pada nota.
  const storeLocations = items.map((item) => item.storeLocation?.trim()).filter((location): location is string => Boolean(location));
  const storeLocation = storeLocations.length === items.length && new Set(storeLocations).size === 1 ? storeLocations[0] : null;
  const storeOrigin = parseCoordinates(storeLocation);
  useEffect(() => {
    let cancelled = false;
    const origin = storeOrigin;
    const destination = parseCoordinates(currentLocation);
    // Jangan menampilkan ongkir berdasarkan hasil rute lama saat lokasi berubah.
    setRouteDistanceKm(null);
    if (!origin || !destination) return;
        getGoogleDrivingDistanceKm(origin, destination).then((distance) => { 
      if (!cancelled) {
        const km = distance > 100 ? distance / 1000 : distance;
        setRouteDistanceKm(km); 
      } 
    }).catch(() => { if (!cancelled) setRouteDistanceKm(null); });

    return () => { cancelled = true; };
  }, [currentLocation, storeLocation]);
  useEffect(() => {
    const loadBuyer = () => {
      try {
        const session = JSON.parse(window.localStorage.getItem(USER_SESSION_KEY) || "null") as { name?: string; phone?: string } | null;
        setIsSignedIn(Boolean(session?.phone));
        const phone = session?.phone || "";
        setBuyerPhone(phone);
        if (session) setForm((current) => ({ ...current, name: current.name || session.name || "", whatsapp: current.whatsapp || phone }));
      } catch {
        setBuyerPhone("");
      }
    };
    loadBuyer();
    const onFocus = () => loadBuyer();
    window.addEventListener(AUTH_EVENT, loadBuyer);
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener(AUTH_EVENT, loadBuyer); window.removeEventListener("focus", onFocus); };
  }, []);
  useEffect(() => {
    const profile = buyerProfile.data;
    if (!open || !profile) return;
    setForm((current) => {
      const next = { ...current, name: profile.name, whatsapp: profile.whatsapp, village: profile.village, address: profile.address || "" };
      return current.name === next.name && current.whatsapp === next.whatsapp && current.village === next.village && current.address === next.address ? current : next;
    });
  }, [buyerProfile.data?.name, buyerProfile.data?.whatsapp, buyerProfile.data?.village, buyerProfile.data?.address, open]);
  useEffect(() => {
    const status = guestRegistrationStatus.data;
    if (!status || status.status === lastGuestStatusRef.current) return;
    lastGuestStatusRef.current = status.status;
    if (status?.status === "rejected") {
      const message = guestReferralCode.trim() ? "Kode referral tidak valid, sudah tidak aktif, atau tidak boleh digunakan sendiri." : "Pesan WhatsApp ditolak. Pastikan pesan berisi kode sesi yang dibuat PASARKU.";
      setGuestRegistrationError(message);
      toast.error("Pendaftaran belum berhasil", { description: message });
    } else if (status?.status === "expired") {
      const message = "Waktu pendaftaran sudah habis. Buat sesi WhatsApp baru lalu kirim pesannya kembali.";
      setGuestRegistrationError(message);
      toast.error("Sesi WhatsApp kedaluwarsa", { description: message });
    } else if (status?.status === "not_found") {
      const message = "Kode sesi tidak ditemukan. Silakan buat sesi WhatsApp baru.";
      setGuestRegistrationError(message);
      toast.error("Sesi WhatsApp tidak ditemukan", { description: message });
    }
    if (status?.status === "verified" && status.whatsapp) {
      const session = { name: form.name || `Warga ${status.whatsapp.slice(-4)}`, phone: status.whatsapp, mode: "registerWhatsApp", signedInAt: new Date().toISOString() };
      window.localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
      window.dispatchEvent(new Event(AUTH_EVENT));
      setIsSignedIn(true); setBuyerPhone(status.whatsapp); setForm((current) => ({ ...current, whatsapp: status.whatsapp || current.whatsapp }));
      setGuestRegistrationOpen(false); setGuestRequestCode(null); setGuestRegistrationError(null);
      toast.success("Pendaftaran berhasil", { description: "Anda sudah masuk. Tekan Buat pesanan untuk melanjutkan." });
    }
  }, [guestRegistrationStatus.data, form.name, guestReferralCode]);
  useEffect(() => {
    if (!guestRegistrationOpen) return;
    window.requestAnimationFrame(() => guestRegistrationCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [guestRegistrationOpen]);
  if (!open) return null;
  const hasFreeShipping = items.length > 0 && items.every((item) => item.sellerFreeShipping === true);
  const buyerCoordinates = parseCoordinates(currentLocation);
  const configuredOrigin = parseCoordinates(`${shipping.originLatitude},${shipping.originLongitude}`);
  const effectiveOrigin = storeOrigin || configuredOrigin;
  const effectiveShipping = storeOrigin ? { ...shipping, originLatitude: String(storeOrigin.latitude), originLongitude: String(storeOrigin.longitude) } : shipping;
  const delivery = calculateShippingCost(effectiveShipping, currentLocation, hasFreeShipping, routeDistanceKm);
  const distanceKm = routeDistanceKm || (effectiveOrigin && buyerCoordinates ? distanceBetweenCoordinates(effectiveOrigin, buyerCoordinates) : 1);
  const handlingFeeRates = Array.from(new Set(items.map((item) => item.storeHandlingFeePercent ?? shipping.handlingFeePercent ?? 0)));
  const handlingFee = Math.round(items.reduce((sum, item) => sum + (item.price * item.quantity * (item.storeHandlingFeePercent ?? shipping.handlingFeePercent ?? 0) / 100), 0));
  const handlingFeeLabel = handlingFeeRates.length > 1 ? "(berdasarkan toko)" : handlingFeeRates[0] ? `(${handlingFeeRates[0]}%)` : "";
  const total = subtotal + handlingFee + delivery;
  const unavailableItems = items.filter((item) => !item.isPreOrder && item.stock !== undefined && (item.stock === 0 || item.quantity > item.stock));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (unavailableItems.length) return toast.error("Ada produk yang stoknya habis", { description: "Hapus item tersebut dari keranjang sebelum checkout." });
    if (!form.name || !form.whatsapp || !form.address) return toast.error("Lengkapi nama, WhatsApp, dan alamat terlebih dahulu.");
    if (!isSignedIn) { setGuestRegistrationOpen(true); return; }
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
    if (mode === "all") clearCart(); else items.forEach((item) => removeItem(item.id));
    onDone();
    toast.success("Pesanan berhasil dibuat.", { description: "Admin PASARKU akan menghubungi Anda via WhatsApp untuk konfirmasi.", action: { label: "Hubungi WA", onClick: () => window.open(buildAdminWhatsAppLink(orderId, form.name, shippingSettings.data?.adminWhatsapp), "_blank", "noopener,noreferrer") } });
    window.setTimeout(() => navigate(`/pesanan/${orderId}`), 300);
  };
  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const startGuestWhatsAppRegistration = async () => {
    const popup = window.open("about:blank", "_blank");
    setGuestRegistrationError(null);
    lastGuestStatusRef.current = null;
    try {
      const result = await createWhatsAppRegistration.mutateAsync({ referralCode: guestReferralCode.trim() || undefined });
      setGuestRequestCode(result.requestCode);
      const target = "6281456015901";
      const message = encodeURIComponent(`DAFTAR PASARKU ${result.requestCode}`);
      const appUrl = `whatsapp://send?phone=${target}&text=${message}`;
      const webUrl = `https://wa.me/${target}?text=${message}`;
      if (popup) { popup.location.href = appUrl; window.setTimeout(() => { if (!popup.closed) popup.location.href = webUrl; }, 1800); }
      else { window.location.href = appUrl; }
      toast.success("WhatsApp dibuka", { description: "Tekan Kirim. Setelah pesan diterima, Anda otomatis kembali ke checkout." });
    } catch (error) { popup?.close(); const message = error instanceof Error ? error.message : "Coba lagi beberapa saat."; setGuestRegistrationError(message); toast.error("Pendaftaran WhatsApp belum siap", { description: message }); }
  };
  const useCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error("Perangkat ini tidak mendukung lokasi terkini.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => { const value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`; setCurrentLocation(value); setLocating(false); toast.success("Lokasi terkini berhasil ditambahkan", { description: "Kurir akan melihat titik lokasi ini bersama alamat terdaftar." }); }, () => { setLocating(false); toast.error("Lokasi belum dapat diakses", { description: "Izinkan akses lokasi di browser atau gunakan alamat terdaftar." }); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };
  return <div className="checkout-backdrop"><div className="checkout-modal"><div className="drawer-heading"><div><span className="eyebrow">Langkah terakhir</span><h2>Checkout COD</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div>{guestRegistrationOpen && !isSignedIn && <div ref={guestRegistrationCardRef} className="guest-registration-card"><div className="guest-registration-icon"><MessageCircle size={22} /></div><span className="eyebrow">Satu langkah lagi</span><h3>Daftar lewat WhatsApp untuk membuat pesanan</h3><p>Anda sudah bisa melihat katalog tanpa daftar. Kirim satu pesan WhatsApp, lalu kembali ke halaman ini untuk menyelesaikan checkout.</p><label>Kode referral <span className="optional">opsional</span><input value={guestReferralCode} onChange={(event) => { setGuestReferralCode(event.target.value.toUpperCase()); setGuestRegistrationError(null); }} placeholder="Contoh: PK00001" maxLength={24} /></label>{guestRegistrationError && <div className="guest-registration-error" role="alert"><X size={15} /><span>{guestRegistrationError}</span></div>}{guestRequestCode && guestRegistrationStatus.data?.status === "pending" && <div className="guest-registration-wait"><RefreshCw size={15} /> Menunggu pesan WhatsApp…</div>}<button className="primary-button full-width" type="button" onClick={startGuestWhatsAppRegistration} disabled={createWhatsAppRegistration.isPending}>{createWhatsAppRegistration.isPending ? "Menyiapkan WhatsApp..." : guestRequestCode ? "Buka WhatsApp lagi" : "Daftar lewat WhatsApp"} <MessageCircle size={17} /></button><button className="resend-button" type="button" onClick={() => setGuestRegistrationOpen(false)}>Kembali ke checkout</button></div>}<form onSubmit={submit} className="checkout-form"><div className="profile-sync-note"><UserRound size={15} /> {buyerProfile.data ? "Data profil tersimpan otomatis." : "Lengkapi data ini agar Admin dapat menghubungi Anda."}</div><div className="form-grid"><label>Nama penerima<input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Contoh: Sari Wulandari" /></label><label>No. WhatsApp<input value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} placeholder="08xxxxxxxxxx" /></label></div><label>Desa / wilayah<select value={form.village} onChange={(e) => setField("village", e.target.value)}>{SAWAHAN_LOCATION_OPTIONS.map((village) => <option key={village}>{village}</option>)}</select>{form.village === LOCATION_OTHER && <input value={customVillage} onChange={(event) => setCustomVillage(event.target.value)} placeholder="Tulis kecamatan/wilayah sendiri" maxLength={80} />}</label><label>Alamat lengkap<input value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Dusun, RT/RW, patokan rumah" /></label><div className="current-location-box"><div><strong>Lokasi pengantaran</strong><small>{currentLocation ? `Lokasi terkini tersimpan: ${currentLocation}` : "Gunakan lokasi terkini bila Anda sedang di luar alamat terdaftar."}</small></div><button className="outline-button" type="button" onClick={useCurrentLocation} disabled={locating}><MapPin size={15} /> {locating ? "Mencari..." : currentLocation ? "Perbarui lokasi" : "Gunakan lokasi terkini"}</button></div><label>Catatan untuk kurir <span className="optional">opsional</span><textarea value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Contoh: titip di warung depan rumah" rows={3} /></label><div className="payment-choice"><div className="payment-icon">▣</div><div><strong>Bayar di tempat (COD)</strong><span>Kurir membawa nota digital dan menagih saat barang sampai.</span></div><Check size={18} /></div><div className="checkout-shipping-summary"><div><span>{routeDistanceKm ? "Jarak rute Google Maps" : currentLocation ? "Jarak estimasi" : "Jarak minimum"}</span><strong>{distanceKm.toFixed(1)} km</strong></div><div><span>Ongkir {hasFreeShipping ? "(gratis dari toko)" : shipping.discountPercent ? `(diskon ${shipping.discountPercent}%)` : ""}</span><strong>{hasFreeShipping ? "Gratis" : formatRupiah(delivery)}</strong></div><div><span>Biaya penanganan {handlingFeeLabel}</span><strong>{formatRupiah(handlingFee)}</strong></div></div><div className="checkout-total"><span>Total yang dibayar</span><strong>{formatRupiah(total)}</strong></div><button className="primary-button full-width" type="submit" disabled={unavailableItems.length > 0}>Buat pesanan <ArrowRight size={17} /></button><p className="fine-print">Setelah dibuat, Admin PASARKU dapat dihubungi via WhatsApp untuk konfirmasi.</p></form></div></div>;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [activeVillage, setActiveVillage] = useState("Semua desa");
  const [activeDistrict, setActiveDistrict] = useState("Semua kecamatan");
  const [activeRegency, setActiveRegency] = useState("Semua kabupaten");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"regular" | "preorder" | "all">("all");
  const { addItem } = useCart();
  const syncedProducts = trpc.marketplace.products.useQuery(undefined, { refetchInterval: 15000 });
  const openStores = trpc.marketplace.openStores.useQuery(undefined, { refetchInterval: 15000 });
  const siteSettings = trpc.marketplace.siteSettings.useQuery(undefined, { refetchInterval: 30000 });
  const catalogProducts = useMemo(() => (syncedProducts.data || []).map((item) => ({ id: String(item.id), sellerId: item.sellerId ?? undefined, name: item.name, vendor: item.vendor, category: item.category, price: item.price, unit: "", accent: "sunset", emoji: "🛍️", imageUrl: item.imageUrl, stock: item.stock, isPreOrder: Boolean(item.isPreOrder), preOrderDays: item.preOrderDays || 0, preOrderActive: Boolean(item.preOrderActive), sellerFreeShipping: item.sellerFreeShipping, storeLocation: item.sellerLocation, storeVillage: item.sellerVillage, storeDistrict: item.sellerDistrict || PASARKU_DISTRICT, storeRegency: PASARKU_REGENCY, openingTime: item.openingTime, closingTime: item.closingTime, description: `${item.name} dari ${item.vendor}.`, location: item.location, eta: "30–45 menit", badge: "Mitra lokal", storeOpen: true } satisfies Product)), [syncedProducts.data]);
  const villages = useMemo(() => {
    const catalogVillages = catalogProducts.map((product) => product.storeVillage || product.location.split(" · ")[0]);
    const baseVillages = activeDistrict === "Semua kecamatan" || activeDistrict === PASARKU_DISTRICT ? [...SAWAHAN_VILLAGES] : [];
    return ["Semua desa", ...Array.from(new Set([...baseVillages, ...catalogVillages])).filter(Boolean).sort((a, b) => a.localeCompare(b, "id-ID"))];
  }, [activeDistrict, catalogProducts]);
  const normalizeFilterValue = (value: string | null | undefined) => (value || "").trim().toLocaleLowerCase("id-ID");
  const visibleProducts = useMemo(() => catalogProducts.filter((product) => (selectedStoreId === null || product.sellerId === selectedStoreId) && (normalizeFilterValue(activeCategory) === normalizeFilterValue("Semua") || normalizeFilterValue(product.category) === normalizeFilterValue(activeCategory)) && (normalizeFilterValue(activeVillage) === normalizeFilterValue("Semua desa") || normalizeFilterValue(product.storeVillage || product.location.split(" · ")[0]) === normalizeFilterValue(activeVillage)) && (normalizeFilterValue(activeDistrict) === normalizeFilterValue("Semua kecamatan") || normalizeFilterValue(product.storeDistrict) === normalizeFilterValue(activeDistrict)) && (normalizeFilterValue(activeRegency) === normalizeFilterValue("Semua kabupaten") || normalizeFilterValue(product.storeRegency) === normalizeFilterValue(activeRegency)) && `${product.name} ${product.vendor}`.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"))), [activeCategory, activeDistrict, activeRegency, activeVillage, catalogProducts, search, selectedStoreId]);
  const hasActiveFilter = activeCategory !== "Semua" || activeDistrict !== "Semua kecamatan" || activeRegency !== "Semua kabupaten" || activeVillage !== "Semua desa" || search.trim().length > 0;
  const visibleOpenStores = useMemo(() => (openStores.data || []).filter((store) => (activeRegency === "Semua kabupaten" || PASARKU_REGENCY === activeRegency) && (activeDistrict === "Semua kecamatan" || normalizeFilterValue(store.district || PASARKU_DISTRICT) === normalizeFilterValue(activeDistrict)) && (activeVillage === "Semua desa" || normalizeFilterValue(store.village) === normalizeFilterValue(activeVillage))), [activeDistrict, activeRegency, activeVillage, openStores.data]);
  const site = siteSettings.data ?? { brandName: "PASARKU", tagline: "Marketplace warga Sawahan", heroTitle: "Belanja dekat,", heroHighlight: "berdampak hebat.", heroDescription: "Temukan produk dan jasa dari tetangga sendiri. PASARKU menghubungkan warga dengan UMKM lokal.", promoActive: 1, promoColor: "orange", promoTitle: "Promo warga Sawahan", promoDescription: "Temukan penawaran terbaru dari toko lokal.", promoCta: "Jelajahi sekarang", logoUrl: null, bannerImageUrl: null, promoStartsAt: null, promoEndsAt: null, promoSlots: null, heroBackgroundUrl: null, heroBackgroundColor: "#ff5a00", heroOverlayColor: "#b72e00", heroOverlayOpacity: 28, heroBackgroundPosition: "center" };
  const now = Date.now();
  const promoInSchedule = (!site.promoStartsAt || new Date(site.promoStartsAt).getTime() <= now) && (!site.promoEndsAt || new Date(site.promoEndsAt).getTime() >= now);
  let promoSlots: PromoSlot[] = [];
  try { promoSlots = site.promoSlots ? JSON.parse(site.promoSlots) : []; } catch { promoSlots = []; }
  if (!promoSlots.length) promoSlots = [{ id: "legacy", title: site.promoTitle, description: site.promoDescription, cta: site.promoCta, color: site.promoColor === "purple" || site.promoColor === "green" ? site.promoColor : "orange", active: Boolean(site.promoActive), startsAt: site.promoStartsAt, endsAt: site.promoEndsAt, bannerImageUrl: site.bannerImageUrl }];
  const visiblePromoSlots = promoSlots.filter((promo) => { const starts = !promo.startsAt || new Date(promo.startsAt).getTime() <= now; const ends = !promo.endsAt || new Date(promo.endsAt).getTime() >= now; return Boolean(promo.active) && starts && ends; });
  const openCatalogFilters = () => {
    setFiltersOpen((current) => !current);
    window.setTimeout(() => document.getElementById("catalog-filter-controls")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };
  const resetCatalogFilters = () => { setActiveCategory("Semua"); setActiveDistrict("Semua kecamatan"); setActiveRegency("Semua kabupaten"); setActiveVillage("Semua desa"); setSearch(""); setSelectedStoreId(null); };
  const addProduct = (product: Product) => { addItem(product); setCartOpen(true); toast.success("Ditambahkan ke keranjang", { description: product.name }); };
  return <div className="app-shell"><Header logoUrl={site.logoUrl} brandName={site.brandName || "PASARKU"} onCart={() => setCartOpen(true)} /><main><section className="hero-section" style={{ backgroundColor: site.heroBackgroundColor || "#d45b39", backgroundImage: site.heroBackgroundUrl ? `url(${site.heroBackgroundUrl})` : undefined, backgroundPosition: site.heroBackgroundPosition || "center", ["--hero-overlay-color" as string]: site.heroOverlayColor || "#7a2f2f", ["--hero-overlay-opacity" as string]: String((site.heroOverlayOpacity ?? 28) / 100) } as React.CSSProperties}><div className="container-wide hero-grid"><div className="hero-copy"><div className="eyebrow eyebrow-light"><Sparkles size={14} /> {site?.tagline || "Marketplace warga Sawahan"}</div><h1>{site?.heroTitle || "Belanja dekat,"}<br /><em>{site?.heroHighlight || "berdampak hebat."}</em></h1><p>{site?.heroDescription || "Temukan produk dan jasa dari tetangga sendiri. PASARKU menghubungkan warga dengan UMKM lokal."}</p><div className="hero-actions"><a href="#jelajahi" className="primary-button light-button">Jelajahi kebutuhan <ArrowRight size={17} /></a><a href="#cara-kerja" className="text-link light-link">Bagaimana cara kerja? <ArrowRight size={15} /></a><Link href="/penjual" className="text-link light-link">Jual sebagai mitra <ArrowRight size={15} /></Link><Link href="/kurir" className="text-link light-link">Daftar sebagai kurir <ArrowRight size={15} /></Link></div><div className="hero-proof"><div className="avatar-stack"><span>R</span><span>B</span><span>S</span><span>+</span></div><div><strong>Untuk warga Sawahan</strong><small>Antar lokal · bayar di tempat</small></div></div></div><div className="hero-visual"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="hero-card hero-card-main"><div className="hero-card-top"><span className="live-dot"></span><span>Pasar hari ini</span><span className="hero-card-location"><MapPin size={13} /> Sawahan</span></div><div className="market-sticker">🧺</div><h3>Semua kebutuhan,<br /><span>dari sekitar kita.</span></h3><div className="hero-mini-row"><div><strong>30–45</strong><small>menit antar</small></div><div><strong>COD</strong><small>bayar di tempat</small></div><div><strong>1 kec.</strong><small>lebih dekat</small></div></div></div><div className="floating-note note-one"><span className="note-icon green">✓</span><div><strong>Kurir lokal aktif</strong><small>Siap mengantar hari ini</small></div></div><div className="floating-note note-two"><span className="note-icon orange">↗</span><div><strong>+ UMKM lokal</strong><small>Makin mudah ditemukan</small></div></div></div></div></section><section className="trust-strip"><div className="container-wide trust-grid"><div><Truck size={18} /><span>Pengiriman satu pintu</span></div><div><PackageCheck size={18} /><span>Produk dari warga sekitar</span></div><div><Check size={18} /><span>COD, sederhana & aman</span></div><div><Clock3 size={18} /><span>Antar hari ini</span></div></div></section>{visiblePromoSlots.map((promo, index) => { const bannerUrl = [promo.bannerImageUrl, site.bannerImageUrl].find((url): url is string => typeof url === "string" && url.trim().length > 0)?.trim(); return <section key={promo.id} id={index === 0 ? "promo" : undefined} className={`promo-block promo-${promo.color}`}><div className="container-wide promo-block-inner">{bannerUrl && <div className="promo-banner-card"><img src={bannerUrl} alt={`Banner ${promo.title}`} loading={index === 0 ? "eager" : "lazy"} /><a className="promo-banner-link" href="#jelajahi" aria-label={`Lihat produk dari ${promo.title}`}>Lihat promo <ArrowRight size={15} /></a></div>}<div className="promo-text-card"><div><span className="eyebrow">{promo.title}</span><h2>{promo.description}</h2></div><a className="primary-button light-button" href="#jelajahi">{promo.cta} <ArrowRight size={16} /></a></div></div></section>; })}<section id="jelajahi" className="catalog-section"><div className="container-wide"><div className="section-heading"><div><div className="eyebrow">Katalog pilihan</div><h2>Butuh apa hari ini?</h2><p>Produk nyata dari penjual PASARKU yang sedang membuka toko.</p></div><button className={`outline-button ${hasActiveFilter || filtersOpen ? "filter-button-active" : ""}`} onClick={openCatalogFilters} aria-expanded={filtersOpen}><SlidersHorizontal size={16} /> {filtersOpen ? "Tutup filter" : hasActiveFilter ? "Filter aktif" : "Filter katalog"}</button></div><div id="catalog-filter-controls" className={`category-row ${filtersOpen ? "filters-open" : ""}`}>{categories.map((category) => <button key={category.label} className={`category-pill ${activeCategory === category.label ? "active" : ""}`} onClick={() => setActiveCategory(category.label)}><span>{category.icon}</span>{category.label}</button>)}<select className="village-filter" value={activeRegency} onChange={(event) => setActiveRegency(event.target.value)} aria-label="Filter kabupaten"><option>Semua kabupaten</option><option>{PASARKU_REGENCY}</option></select><select className="village-filter" value={activeDistrict} onChange={(event) => { setActiveDistrict(event.target.value); setActiveVillage("Semua desa"); }} aria-label="Filter kecamatan"><option>Semua kecamatan</option>{PASARKU_DISTRICTS.map((district) => <option key={district}>{district}</option>)}</select><select className="village-filter" value={activeVillage} onChange={(event) => setActiveVillage(event.target.value)} aria-label="Filter desa toko">{villages.map((village) => <option key={village}>{village}</option>)}</select>{hasActiveFilter && <button type="button" className="filter-reset-button" onClick={resetCatalogFilters}>Reset</button>}</div><div className="catalog-tools"><div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk, toko, atau jasa..." /><kbd>/</kbd></div><span className="result-count">{visibleProducts.length} pilihan tersedia <ChevronDown size={15} /></span></div>{syncedProducts.isLoading || openStores.isLoading ? <div className="empty-results"><div className="empty-icon"><Clock3 size={22} /></div><h3>Memuat toko yang buka</h3><p>Sebentar, kami mengambil toko dan produk yang tersedia.</p></div> : <>{visibleOpenStores.length ? <section className="open-stores-section"><div className="catalog-subheading"><div><span className="eyebrow">Toko</span><h3>Toko yang sedang buka</h3><p>Klik toko untuk melihat produk yang tersedia.</p></div><span className="store-count">{visibleOpenStores.length} toko buka sekarang</span></div><div className="open-store-grid">{visibleOpenStores.map((store) => <StoreCard key={store.id} store={store} selected={selectedStoreId === store.id} onSelect={() => { setSelectedStoreId((current) => current === store.id ? null : store.id); window.setTimeout(() => document.getElementById("produk-katalog")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} onOpen={() => navigate(`/toko/${store.id}`)} />)}</div></section> : null}<div id="produk-katalog" className="product-catalog-compact"><div className="catalog-subheading"><div><h3>{selectedStoreId ? "Produk toko pilihan" : "Produk tersedia"}</h3></div>{selectedStoreId && <button className="filter-reset-button" onClick={() => setSelectedStoreId(null)}>Semua toko</button>}</div>{visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={addProduct} />)}</div> : <div className="empty-results"><div className="empty-icon"><StoreIcon /></div><h3>{selectedStoreId ? "Belum ada produk sesuai filter" : "Belum ada toko yang buka"}</h3><p>{selectedStoreId ? "Pilih toko lain atau reset filter katalog." : "Produk penjual yang sudah disetujui akan tampil di sini saat tokonya dibuka."}</p>{!selectedStoreId && <Link href="/penjual" className="text-link">Daftar sebagai penjual <ArrowRight size={15} /></Link>}</div>}</div></>}<div className="catalog-note"><Sparkles size={17} /><span>Katalog ini menampilkan <strong>produk nyata</strong> dari penjual terverifikasi yang sedang membuka toko. Produk akan hilang otomatis saat toko ditutup.</span></div></div></section><section id="cara-kerja" className="how-section"><div className="container-wide"><div className="section-heading centered"><div><div className="eyebrow">Sederhana dari awal</div><h2>Dari pasar lokal, untuk warga lokal.</h2><p>Alur PASARKU dirancang agar mudah digunakan bersama warga dan mitra lokal.</p></div></div><div className="how-grid"><div className="how-card"><span className="step-number">01</span><div className="how-icon">🧑‍💼</div><h3>Admin kurasi produk</h3><p>Admin mendatangi UMKM, memotret, dan memasukkan produk ke katalog.</p></div><div className="how-card highlighted"><span className="step-number">02</span><div className="how-icon">🛒</div><h3>Warga pesan online</h3><p>Pembeli memilih kebutuhan, mengisi alamat desa, lalu memilih COD.</p></div><div className="how-card"><span className="step-number">03</span><div className="how-icon">🛵</div><h3>Kurir antar ke rumah</h3><p>Pesanan masuk ke dashboard admin, kurir mengambil dan mengantar.</p></div></div></div></section></main><footer className="site-footer"><div className="container-wide footer-inner"><div className="brand"><span className="brand-mark">P</span><span>{site.brandName || "PASARKU"}</span></div><span>Marketplace lokal Kecamatan Sawahan, Nganjuk</span><span>© 2026 PASARKU</span></div></footer><CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={(mode) => { setCheckoutMode(mode); setCartOpen(false); setCheckoutOpen(true); }} /><CheckoutModal open={checkoutOpen} mode={checkoutMode} onClose={() => setCheckoutOpen(false)} onDone={() => setCheckoutOpen(false)} /></div>;
}

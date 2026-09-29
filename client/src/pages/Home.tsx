import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Check, ChevronDown, Clock3, MapPin, Minus, PackageCheck, Plus, Search, Settings, ShoppingBag, SlidersHorizontal, Sparkles, Truck, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { categories, formatRupiah, products, type Product } from "@/data/catalog";
import { useCart } from "@/contexts/CartContext";
import { calculateOrderTotal, makeOrderId } from "@/lib/order";
import { buildAdminWhatsAppLink } from "@/lib/whatsapp";
import { AUTH_EVENT, USER_SESSION_KEY } from "@/lib/auth";

function LogOutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>;
}

function Header({ onCart }: { onCart: () => void }) {
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
        <Link href="/" className="brand" aria-label="PASARKU beranda">
          <span className="brand-mark">P</span>
          <span>PASAR<span>KU</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <a href="#jelajahi">Jelajahi</a>
          <a href="#cara-kerja">Cara kerja</a>
          <Link href="/penjual">Jual di PASARKU</Link>
          <Link href="/admin">Panel admin <span className="nav-dot">Preview</span></Link>
        </nav>
        <div className="header-actions">
          <button className="icon-button cart-trigger" onClick={onCart} aria-label="Buka keranjang">
            <ShoppingBag size={18} />
            {count > 0 && <span className="cart-count">{count}</span>}
          </button>
          {userName ? <div className="profile-menu"><button className="profile-trigger" onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen}><span className="profile-avatar">{userName.charAt(0).toUpperCase()}</span><span className="profile-name">{userName}</span><ChevronDown size={14} /></button>{profileOpen && <div className="profile-dropdown"><div className="profile-dropdown-heading"><span className="profile-avatar large">{userName.charAt(0).toUpperCase()}</span><div><strong>{userName}</strong><small>Pengguna PASARKU</small></div></div><button className="profile-item" onClick={() => toast("Profil pengguna akan dilengkapi pada tahap berikutnya.")}><UserRound size={15} /> Profil pengguna</button><button className="profile-item" onClick={() => toast("Pengaturan akun akan tersedia setelah login nyata diaktifkan.")}><Settings size={15} /> Pengaturan</button><div className="profile-divider"></div><button className="profile-item danger" onClick={logout}><LogOutIcon /> Keluar</button></div>}</div> : <Link href="/masuk" className="login-button">Masuk</Link>}
        </div>
      </div>
    </header>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  return (
    <article className="product-card">
      <Link href={`/produk/${product.id}`} className={`product-visual ${product.accent}`} aria-label={`Lihat ${product.name}`}>
        <span className="product-emoji">{product.emoji}</span>
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
  const delivery = items.length ? 5000 : 0;
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
            <div className="cart-summary"><div><span>Subtotal</span><strong>{formatRupiah(subtotal)}</strong></div><div><span>Antar lokal</span><strong>{formatRupiah(delivery)}</strong></div><div className="summary-total"><span>Total perkiraan</span><strong>{formatRupiah(subtotal + delivery)}</strong></div><p className="summary-note"><Clock3 size={14} /> Diantar 30–45 menit · Bayar COD</p><button className="primary-button full-width" onClick={onCheckout}>Lanjut ke checkout <ArrowRight size={17} /></button></div>
          </>
        )}
      </aside>
    </>
  );
}

function CheckoutModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [, navigate] = useLocation();
  const { items, subtotal, clearCart } = useCart();
  const [form, setForm] = useState({ name: "", whatsapp: "", village: "Sawahan", address: "", note: "" });
  if (!open) return null;
  const total = calculateOrderTotal(subtotal);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.whatsapp || !form.address) return toast.error("Lengkapi nama, WhatsApp, dan alamat terlebih dahulu.");
    const orderId = makeOrderId();
    const order = { id: orderId, customer: form.name, whatsapp: form.whatsapp, village: form.village, address: form.address, note: form.note, items, subtotal, delivery: 5000, total, payment: "COD", createdAt: new Date().toISOString() };
    window.sessionStorage.setItem(`pasarku_order_${orderId}`, JSON.stringify(order));
    clearCart();
    onDone();
    toast.success("Pesanan berhasil dibuat.", { description: "Admin PASARKU akan menghubungi Anda via WhatsApp untuk konfirmasi.", action: { label: "Hubungi WA", onClick: () => window.open(buildAdminWhatsAppLink(orderId, form.name), "_blank", "noopener,noreferrer") } });
    window.setTimeout(() => navigate(`/pesanan/${orderId}`), 300);
  };
  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="checkout-backdrop"><div className="checkout-modal"><div className="drawer-heading"><div><span className="eyebrow">Langkah terakhir</span><h2>Checkout COD</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div><form onSubmit={submit} className="checkout-form"><div className="form-grid"><label>Nama penerima<input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Contoh: Sari Wulandari" /></label><label>No. WhatsApp<input value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} placeholder="08xxxxxxxxxx" /></label></div><label>Desa / wilayah<select value={form.village} onChange={(e) => setField("village", e.target.value)}><option>Sawahan</option><option>Bareng</option><option>Duren</option><option>Margopatut</option></select></label><label>Alamat lengkap<input value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Dusun, RT/RW, patokan rumah" /></label><label>Catatan untuk kurir <span className="optional">opsional</span><textarea value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Contoh: titip di warung depan rumah" rows={3} /></label><div className="payment-choice"><div className="payment-icon">▣</div><div><strong>Bayar di tempat (COD)</strong><span>Kurir membawa nota digital dan menagih saat barang sampai.</span></div><Check size={18} /></div><div className="checkout-total"><span>Total yang dibayar</span><strong>{formatRupiah(total)}</strong></div><button className="primary-button full-width" type="submit">Buat pesanan <ArrowRight size={17} /></button><p className="fine-print">Setelah dibuat, Admin PASARKU dapat dihubungi via WhatsApp untuk konfirmasi.</p></form></div></div>;
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { addItem } = useCart();
  const visibleProducts = useMemo(() => products.filter((product) => (activeCategory === "Semua" || product.category === activeCategory) && `${product.name} ${product.vendor}`.toLowerCase().includes(search.toLowerCase())), [activeCategory, search]);
  const addProduct = (product: Product) => { addItem(product); setCartOpen(true); toast.success("Ditambahkan ke keranjang", { description: product.name }); };
  return <div className="app-shell"><Header onCart={() => setCartOpen(true)} /><main><section className="hero-section"><div className="container-wide hero-grid"><div className="hero-copy"><div className="eyebrow eyebrow-light"><Sparkles size={14} /> Marketplace warga Sawahan</div><h1>Belanja dekat,<br /><em>berdampak hebat.</em></h1><p>Temukan produk dan jasa dari tetangga sendiri. PASARKU menghubungkan warga dengan UMKM lokal, satu kecamatan dalam satu genggaman.</p><div className="hero-actions"><a href="#jelajahi" className="primary-button light-button">Jelajahi kebutuhan <ArrowRight size={17} /></a><a href="#cara-kerja" className="text-link light-link">Bagaimana cara kerja? <ArrowRight size={15} /></a><Link href="/penjual" className="text-link light-link">Jual sebagai mitra <ArrowRight size={15} /></Link><Link href="/kurir" className="text-link light-link">Daftar sebagai kurir <ArrowRight size={15} /></Link></div><div className="hero-proof"><div className="avatar-stack"><span>R</span><span>B</span><span>S</span><span>+</span></div><div><strong>Untuk warga Sawahan</strong><small>Antar lokal · bayar di tempat</small></div></div></div><div className="hero-visual"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="hero-card hero-card-main"><div className="hero-card-top"><span className="live-dot"></span><span>Pasar hari ini</span><span className="hero-card-location"><MapPin size={13} /> Sawahan</span></div><div className="market-sticker">🧺</div><h3>Semua kebutuhan,<br /><span>dari sekitar kita.</span></h3><div className="hero-mini-row"><div><strong>30–45</strong><small>menit antar</small></div><div><strong>COD</strong><small>bayar di tempat</small></div><div><strong>1 kec.</strong><small>lebih dekat</small></div></div></div><div className="floating-note note-one"><span className="note-icon green">✓</span><div><strong>Kurir lokal aktif</strong><small>Siap mengantar hari ini</small></div></div><div className="floating-note note-two"><span className="note-icon orange">↗</span><div><strong>+ UMKM lokal</strong><small>Makin mudah ditemukan</small></div></div></div></div></section><section className="trust-strip"><div className="container-wide trust-grid"><div><Truck size={18} /><span>Pengiriman satu pintu</span></div><div><PackageCheck size={18} /><span>Produk dari warga sekitar</span></div><div><Check size={18} /><span>COD, sederhana & aman</span></div><div><Clock3 size={18} /><span>Antar hari ini</span></div></div></section><section id="jelajahi" className="catalog-section"><div className="container-wide"><div className="section-heading"><div><div className="eyebrow">Katalog pilihan</div><h2>Butuh apa hari ini?</h2><p>Contoh katalog untuk pilot PASARKU di Kecamatan Sawahan.</p></div><button className="outline-button" onClick={() => toast("Filter lanjutan akan hadir setelah data UMKM mulai masuk.")}><SlidersHorizontal size={16} /> Filter</button></div><div className="category-row">{categories.map((category) => <button key={category.label} className={`category-pill ${activeCategory === category.label ? "active" : ""}`} onClick={() => setActiveCategory(category.label)}><span>{category.icon}</span>{category.label}</button>)}</div><div className="catalog-tools"><div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk, toko, atau jasa..." /><kbd>/</kbd></div><span className="result-count">{visibleProducts.length} pilihan tersedia <ChevronDown size={15} /></span></div>{visibleProducts.length ? <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={addProduct} />)}</div> : <div className="empty-results"><div className="empty-icon"><Search size={22} /></div><h3>Belum ada hasil</h3><p>Coba kata kunci atau kategori lain.</p></div>}<div className="catalog-note"><Sparkles size={17} /><span>Data di atas adalah <strong>contoh sementara</strong> untuk diskusi tim. Nantinya admin PASARKU dapat memasukkan katalog UMKM Sawahan dari panel admin.</span></div></div></section><section id="cara-kerja" className="how-section"><div className="container-wide"><div className="section-heading centered"><div><div className="eyebrow">Sederhana dari awal</div><h2>Dari pasar lokal, untuk warga lokal.</h2><p>Alur concierge MVP PASARKU dirancang agar mudah dimulai bersama tim kecil.</p></div></div><div className="how-grid"><div className="how-card"><span className="step-number">01</span><div className="how-icon">🧑‍💼</div><h3>Admin kurasi produk</h3><p>Admin mendatangi UMKM, memotret, dan memasukkan produk ke katalog.</p></div><div className="how-card highlighted"><span className="step-number">02</span><div className="how-icon">🛒</div><h3>Warga pesan online</h3><p>Pembeli memilih kebutuhan, mengisi alamat desa, lalu memilih COD.</p></div><div className="how-card"><span className="step-number">03</span><div className="how-icon">🛵</div><h3>Kurir antar ke rumah</h3><p>Pesanan masuk ke dashboard admin, kurir mengambil dan mengantar.</p></div></div></div></section><section className="admin-cta"><div className="container-wide admin-cta-inner"><div><div className="eyebrow eyebrow-light">Untuk tim PASARKU</div><h2>Semua pesanan,<br /><em>lebih mudah dipantau.</em></h2><p>Lihat contoh dashboard operasional untuk mengelola UMKM, pesanan COD, dan penugasan kurir.</p></div><Link href="/admin" className="primary-button light-button">Buka panel admin <ArrowRight size={17} /></Link></div></section></main><footer className="site-footer"><div className="container-wide footer-inner"><div className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></div><span>Pratinjau MVP · Kecamatan Sawahan, Nganjuk</span><span>© 2026 PASARKU</span></div></footer><CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} /><CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} onDone={() => setCheckoutOpen(false)} /></div>;
}

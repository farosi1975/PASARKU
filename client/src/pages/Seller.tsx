import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronRight, ClipboardList, ImagePlus, LogOut, PackagePlus, Pencil, Phone, Plus, Save, Settings, ShieldCheck, Store, Trash2, Truck, UserRound, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { SELLER_PRODUCTS_KEY, SELLER_SESSION_KEY, type SellerProduct, type SellerProfile, normalizeSellerPhone } from "@/lib/seller";
import { SAWAHAN_VILLAGES } from "@/lib/locations";
import { trpc } from "@/lib/trpc";

type Panel = "products" | "settings";
type AuthMode = "login" | "register";

export default function Seller() {
  const [profile, setProfile] = useState<SellerProfile | null>(() => { try { return JSON.parse(window.localStorage.getItem(SELLER_SESSION_KEY) || "null") as SellerProfile | null; } catch { return null; } });
  const [products, setProducts] = useState<SellerProduct[]>(() => { try { return JSON.parse(window.localStorage.getItem(SELLER_PRODUCTS_KEY) || "[]") as SellerProduct[]; } catch { return []; } });
  const [panel, setPanel] = useState<Panel>("products");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [profileForm, setProfileForm] = useState({ shopName: "", ownerName: "", phone: "", village: "Sawahan" });
  const [productForm, setProductForm] = useState({ name: "", category: "Kuliner", price: "", stock: "", imageData: "" });
  const [selectedCourier, setSelectedCourier] = useState("");
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(null);
  const registerSeller = trpc.marketplace.registerSeller.useMutation();
  const sellerProfile = trpc.marketplace.sellerProfile.useQuery({ whatsapp: normalizeSellerPhone(profileForm.phone) || "0000000000" }, { enabled: false });
  const createProduct = trpc.marketplace.createProduct.useMutation();
  const updateProduct = trpc.marketplace.updateProduct.useMutation();
  const deleteProduct = trpc.marketplace.deleteProduct.useMutation();
  const sellerCouriers = trpc.marketplace.sellerCouriers.useQuery({ whatsapp: profile?.phone || "0000000000" }, { enabled: Boolean(profile?.phone && profile.verificationStatus === "verified") });
  const setSellerCourier = trpc.marketplace.setSellerCourier.useMutation();
  const setSellerOpen = trpc.marketplace.setSellerOpen.useMutation();
  const setSellerFreeShipping = trpc.marketplace.setSellerFreeShipping.useMutation();
  const syncedProducts = trpc.marketplace.sellerProducts.useQuery({ whatsapp: profile?.phone || "0000000000" }, { enabled: Boolean(profile?.phone && profile.verificationStatus === "verified") });
  const phone = normalizeSellerPhone(profileForm.phone);

  useEffect(() => { window.localStorage.setItem(SELLER_PRODUCTS_KEY, JSON.stringify(products)); }, [products]);
  useEffect(() => { if (syncedProducts.data) setProducts(syncedProducts.data.map((item) => ({ id: String(item.id), name: item.name, category: item.category, price: item.price, stock: item.stock, imageUrl: item.imageUrl, createdAt: new Date(item.createdAt).toISOString() }))); }, [syncedProducts.data]);
  useEffect(() => { if (sellerCouriers.data) setSelectedCourier(sellerCouriers.data.preferredCourierId ? String(sellerCouriers.data.preferredCourierId) : ""); }, [sellerCouriers.data]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    if (phone.length < 10) return toast.error("Isi nomor WhatsApp penjual yang valid.");
    try {
      const result = await sellerProfile.refetch();
      if (!result.data) return toast.error("Nomor belum terdaftar sebagai penjual.", { description: "Pilih Daftar penjual baru jika belum memiliki toko." });
      const next: SellerProfile = { shopName: result.data.shopName, ownerName: result.data.ownerName, phone: result.data.whatsapp, village: result.data.village, isOpen: Boolean(result.data.isOpen), freeShipping: Boolean(result.data.freeShipping), verificationStatus: result.data.verificationStatus };
      window.localStorage.setItem(SELLER_SESSION_KEY, JSON.stringify(next));
      setProfile(next);
      toast.success(result.data.verificationStatus === "verified" ? `Selamat datang kembali, ${next.shopName}` : "Data toko ditemukan", { description: result.data.verificationStatus === "verified" ? "Dashboard penjual siap digunakan." : "Pendaftaran masih menunggu verifikasi Admin." });
    } catch (error) { toast.error("Data penjual belum dapat dimuat", { description: error instanceof Error ? error.message : "Periksa koneksi database." }); }
  };

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profileForm.shopName.trim() || !profileForm.ownerName.trim() || phone.length < 10) return toast.error("Lengkapi nama toko, nama pemilik, dan nomor WhatsApp.");
    try {
      const saved = await registerSeller.mutateAsync({ shopName: profileForm.shopName.trim(), ownerName: profileForm.ownerName.trim(), whatsapp: phone, village: profileForm.village });
      const next: SellerProfile = { shopName: saved.shopName, ownerName: saved.ownerName, phone: saved.whatsapp, village: saved.village, isOpen: Boolean(saved.isOpen), freeShipping: Boolean(saved.freeShipping), verificationStatus: saved.verificationStatus };
      window.localStorage.setItem(SELLER_SESSION_KEY, JSON.stringify(next));
      setProfile(next);
      toast.success("Pendaftaran penjual diterima", { description: "Admin akan memeriksa data Anda secara manual." });
    } catch (error) { toast.error("Pendaftaran belum tersimpan", { description: error instanceof Error ? error.message : "Periksa koneksi database." }); }
  };

  const logout = () => { window.localStorage.removeItem(SELLER_SESSION_KEY); setProfile(null); setPanel("products"); setAuthMode("login"); setProfileForm({ shopName: "", ownerName: "", phone: "", village: "Sawahan" }); toast.success("Anda sudah keluar dari portal penjual."); };

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error("Pilih foto JPG, PNG, atau WebP.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Ukuran foto maksimal 5 MB.");
    const reader = new FileReader();
    reader.onload = () => setProductForm((current) => ({ ...current, imageData: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const addProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(productForm.price); const stock = Number(productForm.stock);
    if (!profile || !productForm.name.trim() || !price || stock < 0) return toast.error("Isi nama produk, harga, dan stok dengan benar.");
    try {
      const saved = await createProduct.mutateAsync({ whatsapp: profile.phone, name: productForm.name.trim(), category: productForm.category, price, stock, imageData: productForm.imageData || undefined });
      setProducts((current) => [{ id: String(saved.id || `seller-${Date.now()}`), name: productForm.name.trim(), category: productForm.category, price, stock, imageUrl: saved.imageUrl, createdAt: new Date().toISOString() }, ...current]);
      setProductForm({ name: "", category: "Kuliner", price: "", stock: "", imageData: "" });
      toast.success("Produk tersimpan di database", { description: "Produk langsung tersedia di katalog PASARKU." });
    } catch (error) { toast.error("Produk belum tersimpan", { description: error instanceof Error ? error.message : "Periksa foto dan koneksi storage." }); }
  };

  const beginEdit = (product: SellerProduct) => {
    setEditingProduct(product);
    setProductForm({ name: product.name, category: product.category, price: String(product.price), stock: String(product.stock), imageData: "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveProductEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !editingProduct) return;
    const price = Number(productForm.price); const stock = Number(productForm.stock);
    if (!productForm.name.trim() || !price || stock < 0) return toast.error("Isi nama produk, harga, dan stok dengan benar.");
    try {
      const saved = await updateProduct.mutateAsync({ whatsapp: profile.phone, productId: Number(editingProduct.id), name: productForm.name.trim(), category: productForm.category, price, stock, imageData: productForm.imageData || undefined });
      setProducts((current) => current.map((item) => item.id === editingProduct.id ? { ...item, name: saved.name, category: saved.category, price: saved.price, stock: saved.stock, imageUrl: saved.imageUrl } : item));
      setEditingProduct(null); setProductForm({ name: "", category: "Kuliner", price: "", stock: "", imageData: "" });
      toast.success("Produk diperbarui", { description: "Harga, informasi, dan stok sudah tersimpan." });
    } catch (error) { toast.error("Produk belum diperbarui", { description: error instanceof Error ? error.message : "Periksa koneksi database." }); }
  };

  const removeProduct = (product: SellerProduct) => {
    if (!profile || !window.confirm(`Hapus produk ${product.name} dari toko?`)) return;
    deleteProduct.mutate({ whatsapp: profile.phone, productId: Number(product.id) }, { onSuccess: () => { setProducts((current) => current.filter((item) => item.id !== product.id)); if (editingProduct?.id === product.id) { setEditingProduct(null); setProductForm({ name: "", category: "Kuliner", price: "", stock: "", imageData: "" }); } toast.success("Produk dihapus dari toko."); }, onError: (error) => toast.error("Produk belum dihapus", { description: error.message }) });
  };

  const toggleStore = () => {
    if (!profile) return;
    const nextOpen = profile.isOpen === false;
    setSellerOpen.mutate({ whatsapp: profile.phone, isOpen: nextOpen }, { onSuccess: () => { const next = { ...profile, isOpen: nextOpen }; setProfile(next); window.localStorage.setItem(SELLER_SESSION_KEY, JSON.stringify(next)); toast.success(nextOpen ? "Toko dibuka" : "Toko ditutup", { description: nextOpen ? "Produk kembali tampil di katalog pembeli." : "Produk sementara disembunyikan dari katalog pembeli." }); }, onError: (error) => toast.error("Status toko belum berubah", { description: error.message }) });
  };

  const saveCourier = () => {
    if (!profile) return;
    setSellerCourier.mutate({ whatsapp: profile.phone, courierId: selectedCourier ? Number(selectedCourier) : null }, { onSuccess: () => { sellerCouriers.refetch(); toast.success(selectedCourier ? "Kurir pilihan toko disimpan" : "Pilihan kurir dihapus", { description: "Preferensi tersimpan di database." }); }, onError: (error) => toast.error("Pilihan kurir belum tersimpan", { description: error.message }) });
  };
  const toggleFreeShipping = () => {
    if (!profile) return;
    const nextFreeShipping = profile.freeShipping !== true;
    setSellerFreeShipping.mutate({ whatsapp: profile.phone, freeShipping: nextFreeShipping }, { onSuccess: () => { const next = { ...profile, freeShipping: nextFreeShipping }; setProfile(next); window.localStorage.setItem(SELLER_SESSION_KEY, JSON.stringify(next)); toast.success(nextFreeShipping ? "Gratis ongkir diaktifkan" : "Gratis ongkir dimatikan", { description: nextFreeShipping ? "Pesanan dari toko Anda tidak dikenai ongkir." : "Ongkir kembali mengikuti pengaturan Admin." }); }, onError: (error) => toast.error("Pengaturan gratis ongkir belum berubah", { description: error.message }) });
  };
  const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

  if (!profile) return <div className="seller-auth-page"><header className="seller-header"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><Link href="/" className="back-link"><ArrowLeft size={15} /> Kembali ke Home</Link></header><main className="seller-auth-main"><section className="seller-auth-card"><div className="seller-icon"><Store size={24} /></div><div className="eyebrow">Portal penjual PASARKU</div><h1>{authMode === "login" ? <>Masuk ke toko<br /><em>Anda kembali.</em></> : <>Jual produk<br /><em>dari toko Anda.</em></>}</h1><p>{authMode === "login" ? "Masukkan nomor WhatsApp toko yang sudah terdaftar untuk membuka dashboard tanpa mendaftar ulang." : "Isi data toko dan nomor WhatsApp. Admin PASARKU akan memverifikasi pendaftaran secara manual."}</p><form className="seller-form" onSubmit={authMode === "login" ? login : register}>{authMode === "register" && <><label>Nama toko<input value={profileForm.shopName} onChange={(e) => setProfileForm({ ...profileForm, shopName: e.target.value })} placeholder="Contoh: Warung Bu Sari" /></label><label>Nama pemilik<input value={profileForm.ownerName} onChange={(e) => setProfileForm({ ...profileForm, ownerName: e.target.value })} placeholder="Contoh: Sari Wulandari" /></label></>}<label>Nomor WhatsApp<div className="seller-input-with-icon"><Phone size={15} /><input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="081234567890" inputMode="tel" /></div></label>{authMode === "register" && <label>Desa / wilayah<select value={profileForm.village} onChange={(e) => setProfileForm({ ...profileForm, village: e.target.value })}>{SAWAHAN_VILLAGES.map((village) => <option key={village}>{village}</option>)}</select></label>}<button className="primary-button full-width" type="submit" disabled={registerSeller.isPending || sellerProfile.isFetching}>{authMode === "login" ? (sellerProfile.isFetching ? "Memuat toko..." : "Masuk ke dashboard") : (registerSeller.isPending ? "Menyimpan pendaftaran..." : "Kirim pendaftaran")} <ChevronRight size={17} /></button></form><div className="seller-auth-switch"><span>{authMode === "login" ? "Belum punya toko?" : "Sudah terdaftar sebagai penjual?"}</span><button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setProfileForm({ shopName: "", ownerName: "", phone: "", village: "Sawahan" }); }}>{authMode === "login" ? "Daftar penjual baru" : "Masuk kembali"}</button></div><div className="seller-demo-note"><ShieldCheck size={14} /> Pendaftaran tidak memakai OTP dan menunggu verifikasi Admin.</div></section><aside className="seller-auth-aside"><div className="eyebrow eyebrow-light">Untuk UMKM Sawahan</div><h2>Etalase Anda,<br /><em>lebih dekat.</em></h2><p>Kelola produk, foto katalog, dan kurir pilihan toko dari satu dashboard.</p><div className="seller-aside-point"><Check size={14} /> Masuk kembali tanpa daftar ulang</div><div className="seller-aside-point"><Check size={14} /> Foto produk tersimpan di cloud</div><div className="seller-aside-point"><Check size={14} /> Pilihan kurir tersinkron</div></aside></main></div>;

  if (profile.verificationStatus !== "verified") return <div className="pending-verification-page"><div className="pending-verification-card"><div className="seller-icon"><ShieldCheck size={24} /></div><div className="eyebrow">{profile.verificationStatus === "rejected" ? "Pendaftaran belum disetujui" : "Pendaftaran diterima"}</div><h1>{profile.verificationStatus === "rejected" ? <>Perlu perbaikan<br /><em>data toko.</em></> : <>Menunggu verifikasi<br /><em>Admin PASARKU.</em></>}</h1><p>Data toko <strong>{profile.shopName}</strong> sudah tercatat. {profile.verificationStatus === "rejected" ? "Silakan hubungi Admin untuk mengetahui perbaikan yang diperlukan." : "Dashboard produk akan aktif setelah pendaftaran disetujui."}</p><div className="pending-verification-meta"><span>+{profile.phone}</span><span>{profile.village}</span></div><button className="seller-danger-button" onClick={logout}><LogOut size={16} /> Keluar</button></div></div>;

  return <div className="seller-page"><header className="seller-dashboard-header"><div className="seller-header-inner"><Link href="/" className="brand"><span className="brand-mark">P</span><span>PASAR<span>KU</span></span></Link><div className="seller-header-title"><span>Portal Penjual</span><small>{profile.shopName}</small></div><Link href="/" className="seller-home-link">Lihat Home <ChevronRight size={15} /></Link></div></header><main className="seller-dashboard"><aside className="seller-sidebar"><div className="seller-profile-card"><span className="seller-avatar">{profile.shopName.charAt(0).toUpperCase()}</span><strong>{profile.shopName}</strong><small><ShieldCheck size={12} /> Disetujui Admin</small></div><button className={`seller-nav-item ${panel === "products" ? "active" : ""}`} onClick={() => setPanel("products")}><PackagePlus size={17} /> Produk saya</button><button className={`seller-nav-item ${panel === "settings" ? "active" : ""}`} onClick={() => setPanel("settings")}><Settings size={17} /> Pengaturan</button><div className="seller-sidebar-bottom"><div className="seller-mini-note"><ClipboardList size={15} /><span>Data tersinkron database</span></div><button className="seller-nav-item danger" onClick={logout}><LogOut size={17} /> Keluar</button></div></aside><section className="seller-content">{panel === "products" ? <><div className="seller-content-heading"><div><div className="eyebrow">Katalog toko</div><h1>Kelola produk Anda</h1><p>Tambahkan produk, foto, dan kurir pilihan untuk warga Sawahan.</p></div><span className="seller-verified-badge"><ShieldCheck size={14} /> Disetujui Admin</span><button className={`seller-store-toggle ${profile.isOpen !== false ? "open" : "closed"}`} type="button" onClick={toggleStore} disabled={setSellerOpen.isPending}><span className="store-toggle-dot"></span>{setSellerOpen.isPending ? "Menyimpan..." : profile.isOpen !== false ? "Toko buka" : "Toko tutup"}</button><button className={`seller-free-shipping-toggle ${profile.freeShipping ? "active" : ""}`} type="button" onClick={toggleFreeShipping} disabled={setSellerFreeShipping.isPending}><Truck size={14} /> {setSellerFreeShipping.isPending ? "Menyimpan..." : profile.freeShipping ? "Gratis ongkir aktif" : "Aktifkan gratis ongkir"}</button></div><div className="seller-product-grid"><form className="seller-product-form" onSubmit={editingProduct ? saveProductEdit : addProduct}><div className="seller-form-title"><PackagePlus size={18} /><div><strong>{editingProduct ? "Edit produk" : "Tambah produk"}</strong><small>{editingProduct ? "Perbarui informasi, foto, atau stok produk." : "Produk dan foto tersimpan ke database pusat."}</small></div></div><label>Nama produk<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Contoh: Sambal Pecel Bu Sari" /></label><div className="seller-two-col"><label>Kategori<select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}><option>Kuliner</option><option>Sembako</option><option>Hasil Tani</option><option>Jasa</option></select></label><label>Harga<input value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="15000" inputMode="numeric" /></label></div><label>Stok tersedia<input value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} placeholder="20" inputMode="numeric" /></label><label className="seller-photo-picker"><span><ImagePlus size={16} /> Foto produk</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} /><small>{productForm.imageData ? "Foto siap diunggah · maksimal 5 MB" : "Pilih JPG, PNG, atau WebP"}</small></label>{productForm.imageData && <img className="seller-photo-preview" src={productForm.imageData} alt="Pratinjau produk" />}<div className="seller-form-actions"><button className="primary-button" type="submit" disabled={createProduct.isPending || updateProduct.isPending}>{editingProduct ? <Save size={16} /> : <Plus size={16} />} {editingProduct ? (updateProduct.isPending ? "Menyimpan perubahan..." : "Simpan perubahan") : (createProduct.isPending ? "Mengunggah & menyimpan..." : "Simpan produk")}</button>{editingProduct && <button className="seller-cancel-button" type="button" onClick={() => { setEditingProduct(null); setProductForm({ name: "", category: "Kuliner", price: "", stock: "", imageData: "" }); }}><X size={15} /> Batal</button>}</div></form><div className="seller-products-list"><div className="seller-list-heading"><div><strong>Produk saya</strong><small>{products.length} produk tersimpan</small></div></div>{products.length ? products.map((product) => <div className="seller-product-row" key={product.id}>{product.imageUrl ? <img className="seller-product-thumb" src={product.imageUrl} alt={product.name} /> : <span className="seller-product-mark">{product.name.charAt(0).toUpperCase()}</span>}<div className="seller-product-info"><strong>{product.name}</strong><small>{product.category} · Stok {product.stock}</small></div><b>{rupiah(product.price)}</b><div className="seller-product-actions"><button type="button" className="seller-icon-action" onClick={() => beginEdit(product)} aria-label={`Edit ${product.name}`}><Pencil size={14} /></button><button type="button" className="seller-icon-action danger" onClick={() => removeProduct(product)} aria-label={`Hapus ${product.name}`} disabled={deleteProduct.isPending}><Trash2 size={14} /></button></div></div>) : <div className="seller-empty"><PackagePlus size={22} /><strong>Belum ada produk</strong><span>Tambahkan produk pertama dari form di samping.</span></div>}</div></div><div className="seller-courier-card"><div className="seller-form-title"><Truck size={18} /><div><strong>Kurir pilihan toko</strong><small>Pilih kurir terverifikasi yang biasa mengambil pesanan toko Anda.</small></div></div><div className="seller-courier-controls"><select value={selectedCourier} onChange={(event) => setSelectedCourier(event.target.value)}><option value="">Pilih kurir pilihan</option>{sellerCouriers.data?.couriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name} · {courier.vehicle}</option>)}</select><button className="primary-button" type="button" onClick={saveCourier} disabled={setSellerCourier.isPending || sellerCouriers.isLoading}>{setSellerCourier.isPending ? "Menyimpan..." : "Simpan pilihan kurir"}</button></div>{sellerCouriers.data?.couriers.length ? <small className="seller-courier-note">Pilihan ini tersimpan sebagai preferensi toko. Admin tetap dapat menugaskan kurir lain bila diperlukan.</small> : <small className="seller-courier-note">Belum ada kurir terverifikasi yang tersedia.</small>}</div></> : <div className="seller-settings"><div className="eyebrow">Akun penjual</div><h1>Pengaturan</h1><p>Kelola informasi dasar dan akses portal toko Anda.</p><div className="seller-setting-card"><div className="seller-setting-icon"><Store size={18} /></div><div><strong>{profile.shopName}</strong><small>{profile.ownerName} · +{profile.phone}</small><small>{profile.village}, Kecamatan Sawahan</small></div><span className={`seller-store-status ${profile.isOpen !== false ? "open" : "closed"}`}>{profile.isOpen !== false ? "Toko sedang buka" : "Toko sedang tutup"}</span></div><div className="seller-setting-card"><div className="seller-setting-icon"><Truck size={18} /></div><div><strong>Gratis ongkir</strong><small>{profile.freeShipping ? "Aktif: pembeli tidak dikenai ongkir dari toko ini." : "Nonaktif: ongkir mengikuti tarif Admin PASARKU."}</small></div><button className="seller-settings-action" type="button" onClick={toggleFreeShipping} disabled={setSellerFreeShipping.isPending}>{profile.freeShipping ? "Matikan" : "Aktifkan"}</button></div><div className="seller-setting-card"><div className="seller-setting-icon"><UserRound size={18} /></div><div><strong>Verifikasi manual</strong><small>Pendaftaran diperiksa dan disetujui oleh Admin PASARKU.</small></div></div><button className="seller-danger-button" onClick={logout}><LogOut size={16} /> Keluar dari portal penjual</button></div>}</section></main></div>;
}

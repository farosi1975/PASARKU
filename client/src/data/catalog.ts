export type Product = {
  id: string;
  name: string;
  vendor: string;
  category: string;
  price: number;
  unit: string;
  accent: string;
  emoji: string;
  description: string;
  location: string;
  eta: string;
  imageUrl?: string | null;
  badge?: string;
  storeOpen?: boolean;
  sellerFreeShipping?: boolean;
  storeLocation?: string | null;
  storeVillage?: string;
  openingTime?: string;
  closingTime?: string;
};

export type OrderStatus = "Menunggu" | "Diproses" | "Diantar" | "Selesai";

export type MockOrder = {
  id: string;
  customer: string;
  whatsapp?: string;
  village: string;
  address?: string;
  currentLocation?: string | null;
  pickupLocation?: string | null;
  pickupShopName?: string | null;
  pickupVillage?: string | null;
  routeDistanceKm?: number | null;
  subtotal?: number;
  delivery?: number;
  note?: string;
  total: number;
  items: number;
  payment: "COD" | "Transfer";
  status: OrderStatus;
  time: string;
  courier?: string;
};

export const categories = [
  { label: "Semua", icon: "✦" },
  { label: "Kuliner", icon: "🍜" },
  { label: "Sembako", icon: "🧺" },
  { label: "Hasil tani", icon: "🌾" },
  { label: "Jasa", icon: "🛠" },
];

export const products: Product[] = [
  {
    id: "nasi-pecel-mbah-sari",
    name: "Nasi Pecel Mbah Sari",
    vendor: "Warung Mbah Sari",
    category: "Kuliner",
    price: 12000,
    unit: "/ porsi",
    accent: "sunset",
    emoji: "🍱",
    description: "Nasi pecel khas Sawahan dengan sambal kacang racikan keluarga dan lauk pilihan.",
    location: "Sawahan · 1,2 km",
    eta: "30–45 menit",
    badge: "Favorit warga",
  },
  {
    id: "kopi-robusta-sawahan",
    name: "Kopi Robusta Sawahan",
    vendor: "Kebun Lereng",
    category: "Hasil tani",
    price: 38000,
    unit: "/ 250 gram",
    accent: "forest",
    emoji: "☕",
    description: "Biji kopi robusta pilihan dari lereng Wilangan, dipanggang ringan agar aromanya tetap keluar.",
    location: "Bareng · 2,8 km",
    eta: "Hari ini",
    badge: "Panen lokal",
  },
  {
    id: "paket-sembako-hemat",
    name: "Paket Sembako Hemat",
    vendor: "Toko Bu Rini",
    category: "Sembako",
    price: 75000,
    unit: "/ paket",
    accent: "sky",
    emoji: "🛍️",
    description: "Beras 5 kg, minyak 1 liter, gula 1 kg, dan telur 10 butir untuk kebutuhan rumah.",
    location: "Sawahan · 0,8 km",
    eta: "30–45 menit",
    badge: "Paling praktis",
  },
  {
    id: "sayur-segar-pagi",
    name: "Sayur Segar Pagi",
    vendor: "Kebun Pak Darto",
    category: "Hasil tani",
    price: 18000,
    unit: "/ ikat",
    accent: "lime",
    emoji: "🥬",
    description: "Paket sayur musiman yang dipetik pagi hari: sawi, kangkung, tomat, dan cabai.",
    location: "Duren · 3,1 km",
    eta: "Diantar hari ini",
    badge: "Segar pagi ini",
  },
  {
    id: "servis-ac-rumahan",
    name: "Servis AC Rumahan",
    vendor: "Teknik Jaya",
    category: "Jasa",
    price: 65000,
    unit: "/ unit",
    accent: "lavender",
    emoji: "❄️",
    description: "Cuci AC dan pemeriksaan ringan oleh teknisi lokal berpengalaman.",
    location: "Sawahan · area kecamatan",
    eta: "Janji sesuai jadwal",
    badge: "Bisa dijadwalkan",
  },
  {
    id: "jajan-pasar-campur",
    name: "Jajan Pasar Campur",
    vendor: "Dapur Mbak Yuni",
    category: "Kuliner",
    price: 25000,
    unit: "/ box",
    accent: "rose",
    emoji: "🍡",
    description: "Aneka jajanan pasar untuk sarapan atau acara keluarga, isi 10 potong campur.",
    location: "Margopatut · 2,1 km",
    eta: "30–45 menit",
    badge: "Cocok untuk acara",
  },
];

export const mockOrders: MockOrder[] = [
  { id: "PSK-1048", customer: "Rina Wulandari", village: "Sawahan", total: 50000, items: 2, payment: "COD", status: "Menunggu", time: "08:42", courier: "Belum ditugaskan" },
  { id: "PSK-1047", customer: "Budi Santoso", village: "Duren", total: 93000, items: 3, payment: "Transfer", status: "Diproses", time: "08:18", courier: "Agus · Kurir 01" },
  { id: "PSK-1046", customer: "Siti Aminah", village: "Bareng", total: 38000, items: 1, payment: "COD", status: "Diantar", time: "07:56", courier: "Rudi · Kurir 02" },
  { id: "PSK-1045", customer: "Fajar Pratama", village: "Margopatut", total: 75000, items: 1, payment: "COD", status: "Selesai", time: "07:31", courier: "Agus · Kurir 01" },
];

export const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

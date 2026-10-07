# Panduan Migrasi Data PASARKU dari Manus ke Neon

Dokumen ini menjelaskan cara memindahkan data dari database PASARKU di Manus ke Neon PostgreSQL yang dipakai Render.

## Kondisi saat ini

- **Aplikasi Live:** `https://pasarku.onrender.com`
- **Database tujuan:** Neon PostgreSQL
- **Repository:** `https://github.com/farosi1975/PASARKU.git`
- **Admin default Neon:** `082330503206`
- **Tabel utama tujuan:**
  - `buyer_profiles`
  - `seller_profiles`
  - `courier_profiles`
  - `user_accounts`
  - `products`
  - `orders`
  - `order_items`
  - `admin_profiles`
  - `shipping_settings`

> Migrasi **tidak boleh dilakukan dengan menyalin file database secara langsung**. Database Manus menggunakan koneksi/adapter lama, sedangkan Neon menggunakan PostgreSQL. Data harus diekspor, dibersihkan, lalu diimpor sesuai skema PostgreSQL.

---

## 1. Persiapan sebelum migrasi

### 1.1 Bekukan sementara perubahan data

Selama migrasi, minta tim tidak melakukan hal berikut:

- mendaftar pembeli baru;
- mendaftarkan penjual atau kurir baru;
- menambah atau mengedit produk;
- membuat pesanan baru;
- menugaskan kurir;
- melakukan reset data.

Tujuannya agar jumlah data saat export dan import tetap sama.

### 1.2 Buat backup terpisah

Simpan tiga salinan:

1. backup/export dari database Manus;
2. file hasil transformasi JSON/CSV;
3. backup Neon sebelum import.

Jangan menyimpan `DATABASE_URL`, `FONNTE_TOKEN`, `JWT_SECRET`, atau credential lain di dalam ZIP, GitHub, Google Drive publik, atau chat.

### 1.3 Catat jumlah data awal

Dari database Manus, catat jumlah baris setiap tabel:

```sql
SELECT 'buyer_profiles' AS table_name, COUNT(*) AS total FROM buyer_profiles;
SELECT 'seller_profiles' AS table_name, COUNT(*) AS total FROM seller_profiles;
SELECT 'courier_profiles' AS table_name, COUNT(*) AS total FROM courier_profiles;
SELECT 'products' AS table_name, COUNT(*) AS total FROM products;
SELECT 'orders' AS table_name, COUNT(*) AS total FROM orders;
SELECT 'order_items' AS table_name, COUNT(*) AS total FROM order_items;
SELECT 'admin_profiles' AS table_name, COUNT(*) AS total FROM admin_profiles;
SELECT 'user_accounts' AS table_name, COUNT(*) AS total FROM user_accounts;
```

Perintah di atas dijalankan pada database Manus melalui tool SQL project Manus, bukan pada Neon.

---

## 2. Export dari database Manus

Export setiap tabel sebagai **JSON** atau **CSV UTF-8**. Format JSON lebih aman untuk kolom nullable, timestamp, dan teks alamat.

### 2.1 Data pembeli

Kolom yang dipindahkan:

```text
id, name, whatsapp, village, address,
verificationStatus, isBanned, createdAt, updatedAt
```

Query export:

```sql
SELECT id, name, whatsapp, village, address,
       verificationStatus, isBanned, createdAt, updatedAt
FROM buyer_profiles
ORDER BY id;
```

### 2.2 Data penjual/toko

Kolom yang dipindahkan:

```text
id, shopName, ownerName, whatsapp, village,
preferredCourierId, isOpen, freeShipping,
verificationStatus, isBanned, verifiedAt, createdAt, updatedAt
```

Query export:

```sql
SELECT id, shopName, ownerName, whatsapp, village,
       preferredCourierId, isOpen, freeShipping,
       verificationStatus, isBanned, verifiedAt, createdAt, updatedAt
FROM seller_profiles
ORDER BY id;
```

### 2.3 Data kurir

Kolom yang dipindahkan:

```text
id, name, whatsapp, vehicle, village, address,
verificationStatus, isBanned, verifiedAt, createdAt, updatedAt
```

Query export:

```sql
SELECT id, name, whatsapp, vehicle, village, address,
       verificationStatus, isBanned, verifiedAt, createdAt, updatedAt
FROM courier_profiles
ORDER BY id;
```

### 2.4 Akun multi-role

Jika tabel `user_accounts` sudah ada pada database Manus, export juga:

```sql
SELECT id, whatsapp, displayName,
       isBuyer, isSeller, isCourier, isAdmin,
       createdAt, updatedAt
FROM user_accounts
ORDER BY id;
```

Jika tabel ini belum ada di Manus, tabel tersebut dapat dibentuk ulang dari nomor WhatsApp unik pada tiga tabel profil setelah import.

### 2.5 Produk

```sql
SELECT id, sellerId, name, category, price, stock,
       imageUrl, vendor, location, status,
       createdAt, updatedAt
FROM products
ORDER BY id;
```

Periksa `imageUrl` secara khusus. URL yang hanya berlaku di storage Manus mungkin tidak bisa dibuka dari Render. Jika URL tidak publik atau hanya URL sementara, file gambar harus di-upload ulang ke storage permanen dan kolom `imageUrl` diperbarui.

### 2.6 Pesanan dan item pesanan

Export pesanan:

```sql
SELECT id, orderCode, customerName, whatsapp, village,
       address, currentLocation, note, subtotal, delivery,
       total, payment, status, courierId,
       courierAcceptedAt, createdAt, updatedAt
FROM orders
ORDER BY id;
```

Export item pesanan:

```sql
SELECT id, orderId, productId, productName, price, quantity
FROM order_items
ORDER BY id;
```

> Jika tujuan migrasi hanya user dan katalog, pesanan lama dapat tidak dipindahkan. Jika riwayat transaksi diperlukan, pindahkan `orders` terlebih dahulu lalu `order_items`.

### 2.7 Admin dan pengaturan ongkir

Jangan mengganti admin default Neon dengan data lama tanpa persetujuan. Export hanya untuk perbandingan:

```sql
SELECT id, name, whatsapp, verifiedAt, createdAt, updatedAt
FROM admin_profiles
ORDER BY id;

SELECT id, ratePerKm, discountPercent,
       originLatitude, originLongitude, updatedAt
FROM shipping_settings
ORDER BY id;
```

---

## 3. Normalisasi data sebelum import

### 3.1 Normalisasi nomor WhatsApp

Semua nomor harus memakai format internasional tanpa tanda `+`, spasi, atau tanda baca.

Contoh:

| Data lama | Data Neon |
|---|---|
| `081456015901` | `6281456015901` |
| `082330503206` | `6282330503206` |
| `+6282330503206` | `6282330503206` |

Aturan umum:

- hapus spasi, `-`, dan `+`;
- jika diawali `0`, ganti dengan `62`;
- jangan menggabungkan dua profil berbeda hanya karena nama sama;
- nomor WhatsApp adalah kunci utama pencocokan akun.

### 3.2 Status verifikasi

Gunakan status yang tersedia di PostgreSQL:

```text
pending
verified
rejected
unverified
```

Untuk pembeli, status yang diperbolehkan:

```text
pending
verified
unverified
```

Jika data lama menggunakan `approved`, ubah menjadi `verified`. Jika menggunakan `active`, ubah menjadi `verified` hanya setelah status tersebut memang berarti sudah diverifikasi admin.

### 3.3 Nilai boolean

Field berikut disimpan sebagai angka `0` atau `1`:

```text
isOpen
freeShipping
isBanned
isBuyer
isSeller
isCourier
isAdmin
```

Mapping:

```text
true / 1 / '1'  → 1
false / 0 / '0' → 0
null            → nilai default tabel
```

### 3.4 Desa

Validasi `village` terhadap daftar resmi Kecamatan Sawahan:

```text
Sawahan
Sidorejo
Ngliman
Bareng
Margopatut
Siwalan
Kebonagung
Duren
Bendolo
```

Data dengan ejaan berbeda harus diperiksa manual sebelum import.

---

## 4. Urutan import ke Neon

Import menggunakan urutan berikut agar referensi ID tetap konsisten:

1. `admin_profiles` — pertahankan admin default yang sudah ada;
2. `courier_profiles`;
3. `seller_profiles`;
4. `buyer_profiles`;
5. `user_accounts`;
6. `products`;
7. `orders`;
8. `order_items`;
9. `shipping_settings` bila memang ingin mengganti pengaturan Neon.

### Aturan ID

Ada dua strategi:

#### Strategi A — rekomendasi untuk migrasi pertama

Jangan memaksakan `id` lama. Biarkan PostgreSQL membuat ID baru, lalu buat pemetaan:

```text
old_seller_id → new_seller_id
old_courier_id → new_courier_id
old_product_id → new_product_id
old_order_id → new_order_id
```

Strategi ini paling aman bila data tujuan sudah berisi admin, pengaturan, atau data percobaan.

#### Strategi B — mempertahankan ID lama

Gunakan hanya jika database Neon masih kosong selain admin default dan seluruh relasi lama harus dipertahankan. Setelah insert explicit ID, sequence PostgreSQL harus disesuaikan:

```sql
SELECT setval(
  pg_get_serial_sequence('seller_profiles', 'id'),
  COALESCE((SELECT MAX(id) FROM seller_profiles), 1),
  true
);
```

Lakukan pola yang sama untuk:

```text
courier_profiles
buyer_profiles
user_accounts
products
orders
order_items
admin_profiles
```

---

## 5. Pemetaan relasi penting

### Penjual dan produk

- `products.sellerId` harus mengarah ke ID baru pada `seller_profiles`.
- Jika `sellerId` kosong, gunakan `vendor` sebagai informasi tampilan saja.
- Produk hanya tampil di katalog jika penjual:
  - `verificationStatus = 'verified'`;
  - `isBanned = 0`;
  - `isOpen = 1`;
  - produk `status = 'approved'`.

### Penjual dan kurir pilihan

- `seller_profiles.preferredCourierId` harus mengarah ke ID baru pada `courier_profiles`.
- Jika kurir lama tidak ditemukan atau sudah diblokir, set `preferredCourierId = NULL`.

### Pesanan dan kurir

- `orders.courierId` harus mengarah ke ID baru pada `courier_profiles`.
- Pesanan dengan kurir yang tidak ditemukan jangan dihapus; set `courierId = NULL` dan status kembali ke `Menunggu` agar dapat ditugaskan ulang dari Admin.

### Item pesanan

- `order_items.orderId` harus mengarah ke ID baru pada `orders`.
- `order_items.productId` boleh `NULL` jika produk lama sudah dihapus.
- `productName`, `price`, dan `quantity` tetap dipertahankan sebagai snapshot transaksi.

---

## 6. Verifikasi setelah import

### 6.1 Bandingkan jumlah baris

Jalankan di Neon:

```sql
SELECT 'buyer_profiles' AS table_name, COUNT(*) AS total FROM buyer_profiles
UNION ALL SELECT 'seller_profiles', COUNT(*) FROM seller_profiles
UNION ALL SELECT 'courier_profiles', COUNT(*) FROM courier_profiles
UNION ALL SELECT 'user_accounts', COUNT(*) FROM user_accounts
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items;
```

Jumlah tujuan harus sama dengan jumlah sumber, dikurangi data yang memang sengaja dilewati dan dicatat dalam laporan migrasi.

### 6.2 Cek data yatim

```sql
SELECT p.id, p.sellerId
FROM products p
LEFT JOIN seller_profiles s ON s.id = p.sellerId
WHERE p.sellerId IS NOT NULL AND s.id IS NULL;

SELECT o.id, o.courierId
FROM orders o
LEFT JOIN courier_profiles c ON c.id = o.courierId
WHERE o.courierId IS NOT NULL AND c.id IS NULL;

SELECT oi.id, oi.orderId
FROM order_items oi
LEFT JOIN orders o ON o.id = oi.orderId
WHERE o.id IS NULL;
```

Semua query tersebut idealnya mengembalikan **0 baris**.

### 6.3 Uji aplikasi Live

1. Buka `https://pasarku.onrender.com`.
2. Masukkan password preview `pasarku2016`.
3. Buka **Admin** dan login dengan OTP FONNTE.
4. Periksa tiga sheet:
   - Pembeli;
   - Toko/Penjual;
   - Kurir.
5. Buka Home dan pastikan produk penjual yang:
   - sudah diverifikasi;
   - tidak diblokir;
   - toko sedang buka;
   - status produk `approved`.
6. Login kembali sebagai penjual dan cek produk serta stok.
7. Login sebagai kurir dan cek tugas yang memiliki `courierId`.
8. Buat satu pesanan uji kecil dan pastikan order masuk ke Admin.

---

## 7. Rencana rollback

Jangan hapus database Manus setelah migrasi. Pertahankan sebagai sumber backup sampai semua pihak menyetujui hasilnya.

Jika hasil import bermasalah:

1. hentikan pembuatan pesanan baru sementara;
2. catat tabel dan baris yang bermasalah;
3. kembalikan Render ke database Neon sebelum import, atau hapus hanya data migrasi dengan migration batch ID;
4. perbaiki mapping;
5. ulangi import dalam mode dry-run;
6. lakukan verifikasi ulang.

Untuk migrasi produksi, sebaiknya setiap baris diberi metadata internal seperti `migrationBatchId` atau dicatat dalam file mapping agar data yang diimpor dapat diidentifikasi tanpa menghapus admin default.

---

## 8. Cara paling aman bila ingin saya yang menjalankan

Saya dapat membantu menjalankan proses tersebut secara bertahap:

1. membaca/export data dari database Manus melalui tool database project;
2. menyimpan export sementara di Sandbox tanpa memasukkannya ke GitHub;
3. melakukan normalisasi nomor, desa, status, dan relasi;
4. menampilkan laporan jumlah data sebelum import;
5. meminta persetujuan Anda untuk import ke Neon;
6. menjalankan import dan verifikasi endpoint Live.

Untuk keamanan, jangan kirim ulang `DATABASE_URL`, `FONNTE_TOKEN`, atau PAT melalui chat. Jika credential pernah dibagikan, rotasi setelah migrasi selesai.

> **Rekomendasi:** migrasikan lebih dulu tiga kelompok user—pembeli, penjual, dan kurir—serta produk. Setelah ketiganya tampil benar di Admin dan katalog, baru migrasikan pesanan lama. Ini mengurangi risiko relasi pesanan rusak dan membuat proses mudah dibatalkan.

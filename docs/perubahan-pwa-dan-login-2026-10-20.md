# Dokumentasi Perubahan PWA dan Fitur Login PASARKU

**Tanggal:** 20 Oktober 2026  
**Versi rilis:** `7568fab`  
**Status:** Live di Render

## 1. Ringkasan

PASARKU kini memiliki alur pembukaan yang lebih ramah untuk pengguna mobile, terutama ketika tautan aplikasi dibuka dari WhatsApp. Selain itu, halaman masuk dan pendaftaran pembeli diperbarui agar lebih jelas, konsisten dengan identitas visual PASARKU, dan mudah digunakan pada layar HP.

Perubahan ini tidak menghapus login OTP yang sudah ada. Fitur tersebut tetap dipertahankan, kemudian dilengkapi dengan pilihan pendaftaran OTP dan pendaftaran manual melalui verifikasi Admin.

## 2. Perubahan PWA

### 2.1 Modal pemasangan PASARKU

Saat pengguna membuka PASARKU dari browser atau tautan WhatsApp, aplikasi dapat menampilkan modal:

> **Pasang PASARKU — lebih mudah belanja.**

Modal berisi:

- Penjelasan singkat manfaat memasang PASARKU.
- Tombol **Pasang sekarang**.
- Tombol **Lanjutkan di browser**.
- Tombol **×** untuk menutup modal.
- Ilustrasi visual bernuansa oranye-kuning sesuai branding PASARKU.

### 2.2 Instalasi native dan panduan manual

Jika browser menyediakan event `beforeinstallprompt`, tombol **Pasang sekarang** menjalankan dialog instalasi native browser.

Jika dialog native belum tersedia, aplikasi menampilkan panduan manual Chrome:

1. Tekan menu tiga titik di kanan atas Chrome.
2. Pilih **Tambahkan ke layar utama**.
3. Tekan **Pasang**.

Aplikasi tidak menampilkan modal instalasi ketika sudah dibuka dalam mode standalone/PWA.

### 2.3 Pengelolaan tampilan modal

Status penutupan modal disimpan pada `localStorage` dengan kunci:

```text
pasarku-install-prompt-dismissed-v2
```

Dengan demikian, modal tidak terus muncul setiap kali pengguna berpindah halaman setelah memilih untuk menutupnya.

### 2.4 Notifikasi promo Web Push

Kartu aktivasi notifikasi promo sekarang ditampilkan setelah pengguna menutup modal pemasangan PWA, sehingga alurnya tidak muncul bersamaan dan membingungkan.

Kartu notifikasi berisi:

- Judul **Dapatkan info promo**.
- Penjelasan bahwa promo tetap dapat diterima meskipun PWA sedang ditutup.
- Tombol **Aktifkan**.
- Tombol tutup.

Kartu hanya ditampilkan apabila:

- Browser mendukung `Notification`, `serviceWorker`, dan `PushManager`.
- Izin notifikasi belum diberikan atau ditolak.
- Pengguna belum menutup kartu sebelumnya.
- Public key VAPID tersedia dari backend.

Alur notifikasi promo yang sudah diterapkan:

1. Pengguna membuka PASARKU.
2. Pengguna menutup modal pemasangan atau sudah berada dalam mode PWA.
3. Kartu **Dapatkan info promo** ditampilkan.
4. Pengguna menekan **Aktifkan**.
5. Browser meminta izin notifikasi.
6. Subscription perangkat disimpan ke backend.
7. Job terjadwal mengirim notifikasi berdasarkan slot promo aktif.

## 3. Perubahan halaman masuk

### 3.1 Tampilan baru

Halaman masuk tidak lagi menggunakan tampilan gelap/kotak hitam. Tampilan baru menggunakan:

- Latar krem-oranye.
- Kartu form putih dengan sudut membulat.
- Tombol utama berwarna oranye.
- Logo PASARKU.
- Tombol **Kembali ke etalase**.
- Tata letak responsif untuk layar HP.
- Ikon dan elemen visual yang selaras dengan branding PASARKU.

### 3.2 Tiga pilihan akses

Halaman masuk menampilkan tiga tab:

| Tab | Fungsi |
|---|---|
| **Masuk** | Masuk menggunakan nomor WhatsApp dan OTP. |
| **Daftar OTP** | Membuat akun pembeli baru menggunakan OTP WhatsApp. |
| **Daftar manual** | Mendaftar tanpa OTP dan menunggu persetujuan manual Admin. |

## 4. Alur Masuk dengan OTP

Alur login OTP tetap dipertahankan:

1. Pengguna memilih tab **Masuk**.
2. Pengguna mengisi nomor WhatsApp.
3. PASARKU mengirim kode OTP melalui FONNTE.
4. Pengguna memasukkan OTP 6 digit.
5. Backend memvalidasi kode dan masa berlaku OTP.
6. Jika valid, profil pembeli disimpan sebagai sesi lokal.
7. Pengguna diarahkan kembali ke halaman utama.

Pesan kesalahan tetap diberikan apabila OTP salah, kedaluwarsa, atau percobaan sudah terbatas.

## 5. Alur Pendaftaran dengan OTP

1. Pengguna memilih **Daftar OTP**.
2. Pengguna mengisi nama lengkap dan nomor WhatsApp.
3. PASARKU mengirim OTP melalui FONNTE.
4. Pengguna memasukkan OTP 6 digit.
5. Setelah OTP benar, akun pembeli dibuat dan pengguna masuk ke aplikasi.

## 6. Alur Pendaftaran Manual tanpa OTP

1. Pengguna memilih **Daftar manual**.
2. Pengguna mengisi:
   - Nama lengkap.
   - Nomor WhatsApp.
   - Desa/kecamatan.
   - Alamat lengkap.
3. Data pendaftaran disimpan dengan status menunggu verifikasi.
4. Pendaftaran muncul pada antrean verifikasi Admin.
5. Admin dapat menyetujui atau menolak pendaftaran.
6. Hasil keputusan dikirim melalui WhatsApp.
7. Jika disetujui, halaman pendaftar melakukan polling status.
8. Setelah status disetujui, pengguna otomatis dibuatkan sesi login dan diarahkan ke halaman utama.

Data pendaftaran yang masih menunggu disimpan pada browser agar pengguna dapat kembali memeriksa statusnya.

## 7. File utama yang berubah

- `client/src/components/PwaInstallPrompt.tsx`
  - Modal pemasangan PWA.
  - Dukungan prompt native browser.
  - Panduan pemasangan manual.
  - Penyimpanan status penutupan modal.

- `client/src/components/PushPromoPrompt.tsx`
  - Pengaturan urutan kartu izin notifikasi setelah modal instalasi.
  - Pengelolaan kondisi dukungan Web Push dan permission browser.

- `client/src/push-promo.css`
  - Style modal pemasangan PWA.
  - Style kartu izin notifikasi promo.
  - Tampilan responsif untuk layar mobile.

- `client/src/index.css`
  - Penyelarasan visual halaman masuk dan pendaftaran.
  - Palet krem-oranye PASARKU.
  - Style kartu, tab, form, dan tombol mobile.

- `client/src/pages/Login.tsx`
  - Tetap menjadi pusat alur Masuk, Daftar OTP, dan Daftar manual.
  - Fungsionalitas OTP dan verifikasi Admin tetap dipertahankan.

## 8. Validasi dan deployment

Validasi yang berhasil dijalankan:

- TypeScript check: berhasil.
- Production build: berhasil.
- `git diff --check`: berhasil.
- Halaman production merespons HTTP 200.
- Halaman `/masuk` production menampilkan tiga tab baru.
- Modal pemasangan PWA tampil pada production.
- Commit `7568fab` berhasil dipush ke GitHub `main`.
- Render deployment untuk commit tersebut berstatus **Live**.

## 9. Catatan penggunaan di HP

Jika modal pemasangan belum muncul:

1. Buka tautan PASARKU langsung melalui Chrome.
2. Pastikan bukan sedang dalam mode PWA yang sudah terpasang.
3. Pastikan data situs PASARKU tidak menyimpan status modal sudah ditutup.
4. Bila browser belum menyediakan instalasi native, ikuti panduan menu Chrome.

Jika kartu notifikasi belum muncul:

1. Pastikan izin notifikasi situs belum diblokir.
2. Buka pengaturan situs PASARKU di Chrome.
3. Ubah izin **Notifikasi** menjadi **Izinkan** atau **Tanyakan**.
4. Hapus data situs PASARKU saja bila status lama masih tersimpan.
5. Buka ulang PASARKU dan tutup modal pemasangan terlebih dahulu.

Menghapus data situs PASARKU tidak sama dengan menghapus seluruh riwayat penjelajahan Chrome.

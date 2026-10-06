# Deployment PASARKU ke Neon.tech + Render

## Status saat ini

- Database PASARKU sudah dimigrasikan ke **PostgreSQL Neon**.
- Sepuluh tabel berhasil terbentuk: `users`, `user_accounts`, `admin_profiles`, `buyer_profiles`, `seller_profiles`, `courier_profiles`, `products`, `orders`, `order_items`, dan `shipping_settings`.
- Driver aplikasi sudah berpindah dari `mysql2` ke `pg`.
- Konfigurasi schema PostgreSQL berada di `drizzle/schema.ts`.
- Konfigurasi push schema Neon berada di `drizzle.neon.config.ts`.
- Konfigurasi deployment Render berada di `render.yaml`.
- Perintah migrasi schema: `pnpm db:push:neon`.

## Environment Variables Render

Masukkan variable berikut di **Render → Service → Environment → Add Environment Variable**.

| Variable | Wajib | Nilai / sumber |
|---|---:|---|
| `NODE_ENV` | Ya | `production` |
| `DATABASE_URL` | Ya | Connection string PostgreSQL Neon, memakai `sslmode=require` atau pooled connection string Neon |
| `JWT_SECRET` | Ya | Secret acak panjang; Render dapat membuat otomatis lewat `generateValue: true` |
| `FONNTE_TOKEN` | Ya untuk OTP | Token device/account FONNTE aktif; masukkan sebagai secret, jangan commit |
| `VITE_APP_ID` | Ya untuk Manus OAuth | Nilai dari konfigurasi project Manus |
| `OAUTH_SERVER_URL` | Ya untuk OAuth | URL OAuth Manus dari konfigurasi project |
| `VITE_OAUTH_PORTAL_URL` | Ya untuk login OAuth | URL portal OAuth Manus |
| `OWNER_OPEN_ID` | Ya untuk admin owner | Open ID pemilik dari konfigurasi project |
| `OWNER_NAME` | Disarankan | Nama pemilik/admin utama |
| `BUILT_IN_FORGE_API_URL` | Ya untuk fitur server Manus | URL built-in Forge API project |
| `BUILT_IN_FORGE_API_KEY` | Ya untuk fitur server Manus | API key server-side Forge; simpan sebagai secret |
| `VITE_FRONTEND_FORGE_API_URL` | Ya untuk fitur browser | URL Forge API frontend |
| `VITE_FRONTEND_FORGE_API_KEY` | Ya untuk fitur browser/Maps | API key frontend Forge sesuai konfigurasi project |

`PORT` tidak perlu dibuat manual karena Render mengisinya otomatis. `render.yaml` sudah memakai build dan start command yang benar.

## Langkah klik di Render

1. Buka [Render Dashboard](https://dashboard.render.com/).
2. Pilih **New → Web Service**.
3. Hubungkan repository GitHub `farosi1975/PASARKU`.
4. Pilih branch `main`.
5. Pastikan runtime **Node**.
6. Set region **Singapore** jika tersedia.
7. Build command:
   ```bash
   corepack enable && pnpm install --frozen-lockfile && pnpm build
   ```
8. Start command:
   ```bash
   pnpm start
   ```
9. Buka bagian **Environment** dan masukkan variable pada tabel di atas.
10. Klik **Create Web Service**.
11. Setelah deploy selesai, buka log dan pastikan muncul server production tanpa error database.

File `render.yaml` dapat dipakai melalui **New → Blueprint** jika Render menawarkan konfigurasi Blueprint dari repository.

## Menjalankan push schema Neon setelah perubahan database

Dari repository lokal atau build environment yang memiliki `DATABASE_URL` Neon:

```bash
pnpm db:push:neon
```

Perintah ini memakai `drizzle.neon.config.ts` dan tidak menggunakan migration MySQL lama.

## Catatan keamanan

- Jangan menaruh `DATABASE_URL`, `FONNTE_TOKEN`, `JWT_SECRET`, atau API key di GitHub.
- Jika credential pernah dibagikan di chat atau tempat umum, cabut dan buat ulang.
- Untuk production, gunakan pooled connection string Neon bila tersedia.
- Setelah deployment pertama, uji login pembeli, OTP FONNTE, checkout, panel admin, portal penjual, dan portal kurir.

## Vercel

PASARKU saat ini adalah server Express long-running dengan tRPC dan upload/storage proxy, sehingga **Render lebih cocok sebagai target deployment pertama**. Vercel memerlukan adapter serverless khusus dan penyesuaian entrypoint sebelum dipakai. Jangan menggunakan konfigurasi static-only Vercel karena endpoint `/api/trpc` tidak akan berjalan dengan benar.

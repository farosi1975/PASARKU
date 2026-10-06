import { z } from "zod";
import { randomBytes, randomInt } from "node:crypto";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getAccountRoles, getAdminProfile, getAdminUserDirectory, getBuyerProfile, getDashboardStats, getDb, getOrderWithItems, listAdminProfiles, listApprovedProducts, listCourierOrders, listCouriers, listOrders, listSellerCouriers, listSellerProducts, resetMarketplaceData, saveShippingSettings, getShippingSettings, upsertAccountRole } from "./db";
import { adminProfiles, buyerProfiles, courierProfiles, orderItems, orders, products, sellerProfiles } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { sendFonnteMessage } from "./fonnte";
import { storagePut } from "./storage";
import { calculateShippingCost } from "../shared/shipping";

const phone = z.string().min(10).max(32);
const dbRequired = async () => { const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database belum tersedia." }); return db; };
const adminSessionToken = z.string().min(32).max(128);
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_TTL_MS = 5 * 60 * 1000;
const otpLastSent = new Map<string, number>();
const adminChallenges = new Map<string, { otp: string; expiresAt: number; attempts: number }>();
const adminSessions = new Map<string, { whatsapp: string; expiresAt: number }>();
const buyerChallenges = new Map<string, { otp: string; name?: string; expiresAt: number; attempts: number }>();
const sellerChallenges = new Map<string, { otp: string; shopName: string; ownerName: string; village: string; expiresAt: number; attempts: number }>();
const courierChallenges = new Map<string, { otp: string; name: string; vehicle: string; expiresAt: number; attempts: number }>();
const normalizePhone = (value: string) => { const digits = value.replace(/\D/g, ""); return digits.startsWith("0") ? `62${digits.slice(1)}` : digits; };
const otpKey = (scope: string, whatsapp: string) => `${scope}:${whatsapp}`;
const beginOtpSend = (scope: string, whatsapp: string) => {
  const key = otpKey(scope, whatsapp); const lastSent = otpLastSent.get(key) ?? 0; const remaining = OTP_COOLDOWN_MS - (Date.now() - lastSent);
  if (remaining > 0) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Tunggu ${Math.ceil(remaining / 1000)} detik sebelum meminta OTP lagi.` });
  otpLastSent.set(key, Date.now());
};
const cancelOtpCooldown = (scope: string, whatsapp: string) => { otpLastSent.delete(otpKey(scope, whatsapp)); };
const uploadProductImage = async (whatsapp: string, imageData?: string) => {
  if (!imageData) return null;
  const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Foto harus berupa JPG, PNG, atau WebP." });
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Ukuran foto maksimal 5 MB." });
  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const stored = await storagePut(`pasarku/products/${whatsapp}.${extension}`, buffer, match[1]);
  return stored.url;
};
const invalidOtp = (challenge: { attempts: number }, message: string) => {
  challenge.attempts += 1;
  return new TRPCError({ code: "UNAUTHORIZED", message: challenge.attempts >= OTP_MAX_ATTEMPTS ? "Batas 5 percobaan tercapai. Minta OTP baru setelah cooldown." : `${message} Percobaan tersisa ${OTP_MAX_ATTEMPTS - challenge.attempts}.` });
};
const requireAdminSession = async (token: string) => {
  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) { adminSessions.delete(token); throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesi admin berakhir. Silakan masuk kembali." }); }
  const profile = await getAdminProfile(session.whatsapp);
  if (!profile) { adminSessions.delete(token); throw new TRPCError({ code: "FORBIDDEN", message: "Admin tidak terverifikasi." }); }
  return profile;
};
const notifyVerificationResult = async (target: string, role: "seller" | "courier", status: "verified" | "rejected", displayName: string) => {
  const roleLabel = role === "seller" ? "penjual" : "kurir";
  const statusText = status === "verified" ? "disetujui" : "ditolak";
  const message = status === "verified"
    ? `PASARKU: Pendaftaran Anda sebagai ${roleLabel} (${displayName}) telah DISETUJUI Admin. Silakan masuk kembali ke portal PASARKU untuk melanjutkan.`
    : `PASARKU: Pendaftaran Anda sebagai ${roleLabel} (${displayName}) belum dapat disetujui Admin. Silakan hubungi Admin PASARKU untuk informasi lebih lanjut.`;
  try {
    await sendFonnteMessage(target, message);
    return { sent: true as const, statusText };
  } catch (error) {
    console.error(`[FONNTE] Notifikasi verifikasi ${roleLabel} gagal:`, error instanceof Error ? error.message : error);
    return { sent: false as const, statusText };
  }
};
const notifyCourierAssignment = async (target: string, orderCode: string, total: number, source: "otomatis" | "Admin") => {
  const message = `PASARKU: Pesanan ${orderCode} telah ditugaskan ${source === "otomatis" ? "secara otomatis berdasarkan pilihan toko" : "oleh Admin"} kepada Anda. Total COD: Rp${total.toLocaleString("id-ID")}. Buka portal kurir untuk menerima dan mengantar tugas.`;
  try {
    await sendFonnteMessage(target, message);
    return { sent: true as const };
  } catch (error) {
    console.error("[FONNTE] Notifikasi assignment kurir gagal:", error instanceof Error ? error.message : error);
    return { sent: false as const };
  }
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  marketplace: router({
    products: publicProcedure.query(() => listApprovedProducts()),
    requestBuyerOtp: publicProcedure.input(z.object({ whatsapp: phone, name: z.string().min(2).optional() })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      beginOtpSend("buyer", whatsapp);
      const otp = String(randomInt(100000, 1000000));
      buyerChallenges.set(whatsapp, { otp, name: input.name?.trim(), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
      try {
        await sendFonnteMessage(whatsapp, `Kode OTP PASARKU: ${otp}. Berlaku 5 menit. Jangan bagikan kode ini.`);
      } catch (error) {
        buyerChallenges.delete(whatsapp);
        cancelOtpCooldown("buyer", whatsapp);
        throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "OTP FONNTE gagal dikirim." });
      }
      return { success: true, expiresIn: 300 } as const;
    }),
    verifyBuyerOtp: publicProcedure.input(z.object({ whatsapp: phone, otp: z.string().regex(/^\d{6}$/) })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      const challenge = buyerChallenges.get(whatsapp);
      if (!challenge || challenge.expiresAt < Date.now()) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP belum benar atau sudah kedaluwarsa. Minta OTP baru." });
      if (challenge.otp !== input.otp) { const error = invalidOtp(challenge, "OTP belum benar."); if (challenge.attempts >= OTP_MAX_ATTEMPTS) buyerChallenges.delete(whatsapp); throw error; }
      buyerChallenges.delete(whatsapp);
      const existing = await getBuyerProfile(whatsapp);
      if (existing?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun pembeli diblokir oleh Admin PASARKU." });
      const displayName = existing?.name || challenge.name || `Warga ${whatsapp.slice(-4)}`;
      if (!existing) {
        const db = await dbRequired();
        await db.insert(buyerProfiles).values({ name: displayName, whatsapp, village: "Sawahan", address: "", verificationStatus: "verified", isBanned: 0 });
      }
      await upsertAccountRole(whatsapp, "buyer", displayName);
      return { name: displayName, whatsapp };
    }),
    requestAdminOtp: publicProcedure.input(z.object({ whatsapp: phone })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      const profile = await getAdminProfile(whatsapp);
      if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "Nomor belum terdaftar sebagai admin terverifikasi." });
      beginOtpSend("admin", whatsapp);
      const otp = String(randomInt(100000, 1000000));
      adminChallenges.set(whatsapp, { otp, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
      try {
        await sendFonnteMessage(whatsapp, `Kode OTP Admin PASARKU: ${otp}. Berlaku 5 menit. Jangan bagikan kode ini.`);
      } catch (error) {
        adminChallenges.delete(whatsapp);
        cancelOtpCooldown("admin", whatsapp);
        throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "OTP FONNTE gagal dikirim." });
      }
      return { success: true, expiresIn: 300 } as const;
    }),
    verifyAdminOtp: publicProcedure.input(z.object({ whatsapp: phone, otp: z.string().regex(/^\d{6}$/) })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      const challenge = adminChallenges.get(whatsapp);
      if (!challenge || challenge.expiresAt < Date.now()) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP admin tidak valid atau sudah kedaluwarsa. Minta OTP baru." });
      if (challenge.otp !== input.otp) { const error = invalidOtp(challenge, "OTP admin tidak valid."); if (challenge.attempts >= OTP_MAX_ATTEMPTS) adminChallenges.delete(whatsapp); throw error; }
      const profile = await getAdminProfile(whatsapp);
      if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "Admin tidak terverifikasi." });
      adminChallenges.delete(whatsapp);
      await upsertAccountRole(whatsapp, "admin", profile.name);
      const sessionToken = randomBytes(32).toString("hex");
      adminSessions.set(sessionToken, { whatsapp, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
      return { sessionToken, admin: profile };
    }),
    adminLogout: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).mutation(({ input }) => { adminSessions.delete(input.sessionToken); return { success: true } as const; }),
    adminList: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listAdminProfiles(); }),
    addAdmin: publicProcedure.input(z.object({ sessionToken: adminSessionToken, name: z.string().min(2), whatsapp: phone })).mutation(async ({ input }) => {
      await requireAdminSession(input.sessionToken);
      const db = await dbRequired();
      const whatsapp = normalizePhone(input.whatsapp);
      await db.insert(adminProfiles).values({ name: input.name.trim(), whatsapp, verifiedAt: new Date() }).onDuplicateKeyUpdate({ set: { name: input.name.trim(), verifiedAt: new Date() } });
      return getAdminProfile(whatsapp);
    }),
    sellerProfile: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => {
      const db = await dbRequired();
      const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      return rows[0] ?? null;
    }),
    setSellerOpen: publicProcedure.input(z.object({ whatsapp: phone, isOpen: z.boolean() })).mutation(async ({ input }) => {
      const db = await dbRequired();
      const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      await db.update(sellerProfiles).set({ isOpen: input.isOpen ? 1 : 0, updatedAt: new Date() }).where(eq(sellerProfiles.id, seller[0].id));
      return { isOpen: input.isOpen } as const;
    }),
    setSellerFreeShipping: publicProcedure.input(z.object({ whatsapp: phone, freeShipping: z.boolean() })).mutation(async ({ input }) => {
      const db = await dbRequired();
      const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      await db.update(sellerProfiles).set({ freeShipping: input.freeShipping ? 1 : 0, updatedAt: new Date() }).where(eq(sellerProfiles.id, seller[0].id));
      return { freeShipping: input.freeShipping } as const;
    }),
    shippingSettings: publicProcedure.query(() => getShippingSettings()),

    sellerProducts: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => listSellerProducts(input.whatsapp)),
    sellerCouriers: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => {
      const db = await dbRequired();
      const seller = await db.select({ preferredCourierId: sellerProfiles.preferredCourierId }).from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      return { couriers: await listSellerCouriers(), preferredCourierId: seller[0]?.preferredCourierId ?? null };
    }),
    setSellerCourier: publicProcedure.input(z.object({ whatsapp: phone, courierId: z.number().int().positive().nullable() })).mutation(async ({ input }) => {
      const db = await dbRequired();
      const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      if (input.courierId) {
        const courier = await db.select().from(courierProfiles).where(and(eq(courierProfiles.id, input.courierId), eq(courierProfiles.verificationStatus, "verified"), eq(courierProfiles.isBanned, 0))).limit(1);
        if (!courier[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Kurir pilihan tidak tersedia." });
      }
      await db.update(sellerProfiles).set({ preferredCourierId: input.courierId }).where(eq(sellerProfiles.id, seller[0].id));
      return { preferredCourierId: input.courierId } as const;
    }),
    requestSellerOtp: publicProcedure.input(z.object({ shopName: z.string().min(2), ownerName: z.string().min(2), whatsapp: phone, village: z.string().min(2) })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      beginOtpSend("seller", whatsapp);
      const otp = String(randomInt(100000, 1000000));
      sellerChallenges.set(whatsapp, { otp, shopName: input.shopName.trim(), ownerName: input.ownerName.trim(), village: input.village, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
      try { await sendFonnteMessage(whatsapp, `Kode OTP Penjual PASARKU: ${otp}. Berlaku 5 menit. Jangan bagikan kode ini.`); }
      catch (error) { sellerChallenges.delete(whatsapp); cancelOtpCooldown("seller", whatsapp); throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "OTP FONNTE gagal dikirim." }); }
      return { success: true, expiresIn: 300 } as const;
    }),
    verifySellerOtp: publicProcedure.input(z.object({ whatsapp: phone, otp: z.string().regex(/^\d{6}$/) })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp); const challenge = sellerChallenges.get(whatsapp);
      if (!challenge || challenge.expiresAt < Date.now()) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP penjual belum benar atau sudah kedaluwarsa. Minta OTP baru." });
      if (challenge.otp !== input.otp) { const error = invalidOtp(challenge, "OTP penjual belum benar."); if (challenge.attempts >= OTP_MAX_ATTEMPTS) sellerChallenges.delete(whatsapp); throw error; }
      const db = await dbRequired(); await db.insert(sellerProfiles).values({ shopName: challenge.shopName, ownerName: challenge.ownerName, whatsapp, village: challenge.village, verificationStatus: "verified", verifiedAt: new Date() }).onDuplicateKeyUpdate({ set: { shopName: challenge.shopName, ownerName: challenge.ownerName, village: challenge.village, verificationStatus: "verified", verifiedAt: new Date() } });
      sellerChallenges.delete(whatsapp); const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1); await upsertAccountRole(whatsapp, "seller", challenge.ownerName); return rows[0];
    }),
    registerSeller: publicProcedure.input(z.object({ shopName: z.string().min(2), ownerName: z.string().min(2), whatsapp: phone, village: z.string().min(2) })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const existing = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1); if (existing[0]?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun toko ini diblokir oleh Admin PASARKU." });
      await db.insert(sellerProfiles).values({ shopName: input.shopName.trim(), ownerName: input.ownerName.trim(), whatsapp, village: input.village, verificationStatus: "pending", verifiedAt: null }).onDuplicateKeyUpdate({ set: { shopName: input.shopName.trim(), ownerName: input.ownerName.trim(), village: input.village, verificationStatus: "pending", verifiedAt: null, updatedAt: new Date() } });
      await upsertAccountRole(whatsapp, "seller", input.ownerName.trim());
      const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1); return rows[0];
    }),
    createProduct: publicProcedure.input(z.object({ whatsapp: phone, name: z.string().min(2), category: z.string().min(2), price: z.number().int().positive(), stock: z.number().int().nonnegative(), imageData: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1); if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual masih menunggu verifikasi manual Admin." });
      const imageUrl = await uploadProductImage(normalizePhone(input.whatsapp), input.imageData);
      const result = await db.insert(products).values({ sellerId: seller[0].id, name: input.name, category: input.category, price: input.price, stock: input.stock, imageUrl, vendor: seller[0].shopName, location: seller[0].village, status: "approved" });
      return { id: Number((result as any)[0]?.insertId ?? 0), imageUrl, status: "approved" as const };
    }),
    updateProduct: publicProcedure.input(z.object({ whatsapp: phone, productId: z.number().int().positive(), name: z.string().min(2), category: z.string().min(2), price: z.number().int().positive(), stock: z.number().int().nonnegative(), imageData: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp);
      const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      const product = await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.sellerId, seller[0].id))).limit(1);
      if (!product[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Produk tidak ditemukan di toko Anda." });
      const imageUrl = input.imageData ? await uploadProductImage(whatsapp, input.imageData) : product[0].imageUrl;
      await db.update(products).set({ name: input.name.trim(), category: input.category, price: input.price, stock: input.stock, imageUrl, vendor: seller[0].shopName, location: seller[0].village, updatedAt: new Date() }).where(eq(products.id, input.productId));
      const rows = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      return rows[0];
    }),
    deleteProduct: publicProcedure.input(z.object({ whatsapp: phone, productId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp);
      const seller = await db.select({ id: sellerProfiles.id, verificationStatus: sellerProfiles.verificationStatus, isBanned: sellerProfiles.isBanned }).from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      const product = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.sellerId, seller[0].id))).limit(1);
      if (!product[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Produk tidak ditemukan di toko Anda." });
      await db.delete(products).where(eq(products.id, input.productId));
      return { success: true as const, productId: input.productId };
    }),
    requestCourierOtp: publicProcedure.input(z.object({ name: z.string().min(2), whatsapp: phone, vehicle: z.string().min(2) })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp); beginOtpSend("courier", whatsapp); const otp = String(randomInt(100000, 1000000));
      courierChallenges.set(whatsapp, { otp, name: input.name.trim(), vehicle: input.vehicle, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 });
      try { await sendFonnteMessage(whatsapp, `Kode OTP Kurir PASARKU: ${otp}. Berlaku 5 menit. Jangan bagikan kode ini.`); }
      catch (error) { courierChallenges.delete(whatsapp); cancelOtpCooldown("courier", whatsapp); throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "OTP FONNTE gagal dikirim." }); }
      return { success: true, expiresIn: 300 } as const;
    }),
    verifyCourierOtp: publicProcedure.input(z.object({ whatsapp: phone, otp: z.string().regex(/^\d{6}$/) })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp); const challenge = courierChallenges.get(whatsapp);
      if (!challenge || challenge.expiresAt < Date.now()) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP kurir belum benar atau sudah kedaluwarsa. Minta OTP baru." });
      if (challenge.otp !== input.otp) { const error = invalidOtp(challenge, "OTP kurir belum benar."); if (challenge.attempts >= OTP_MAX_ATTEMPTS) courierChallenges.delete(whatsapp); throw error; }
      const db = await dbRequired(); await db.insert(courierProfiles).values({ name: challenge.name, whatsapp, vehicle: challenge.vehicle, verificationStatus: "verified", verifiedAt: new Date() }).onDuplicateKeyUpdate({ set: { name: challenge.name, vehicle: challenge.vehicle, verificationStatus: "verified", verifiedAt: new Date() } });
      courierChallenges.delete(whatsapp); const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, whatsapp)).limit(1); await upsertAccountRole(whatsapp, "courier", challenge.name); return rows[0];
    }),
    registerCourier: publicProcedure.input(z.object({ name: z.string().min(2), whatsapp: phone, vehicle: z.string().min(2), village: z.string().min(2).default("Sawahan"), address: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const existing = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, whatsapp)).limit(1); if (existing[0]?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun kurir ini diblokir oleh Admin PASARKU." });
      await db.insert(courierProfiles).values({ name: input.name.trim(), whatsapp, vehicle: input.vehicle, village: input.village, address: input.address?.trim() || null, verificationStatus: "pending", verifiedAt: null }).onDuplicateKeyUpdate({ set: { name: input.name.trim(), vehicle: input.vehicle, village: input.village, address: input.address?.trim() || null, verificationStatus: "pending", verifiedAt: null, updatedAt: new Date() } });
      await upsertAccountRole(whatsapp, "courier", input.name.trim());
      const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, whatsapp)).limit(1); return rows[0];
    }),
    buyerProfile: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => getBuyerProfile(normalizePhone(input.whatsapp))),
    accountRoles: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => getAccountRoles(normalizePhone(input.whatsapp))),
    saveBuyerProfile: publicProcedure.input(z.object({ name: z.string().min(2), whatsapp: phone, village: z.string().min(2), address: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const existing = await getBuyerProfile(whatsapp); if (existing?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun pembeli diblokir oleh Admin PASARKU." });
      await db.insert(buyerProfiles).values({ ...input, whatsapp }).onDuplicateKeyUpdate({ set: { name: input.name, village: input.village, address: input.address ?? null, updatedAt: new Date() } });
      await upsertAccountRole(whatsapp, "buyer", input.name.trim());
      return getBuyerProfile(whatsapp);
    }),
    createOrder: publicProcedure.input(z.object({ customerName: z.string().min(2), whatsapp: phone, village: z.string().min(2), address: z.string().min(3), currentLocation: z.string().max(180).optional(), note: z.string().optional(), subtotal: z.number().int().nonnegative(), delivery: z.number().int().nonnegative(), total: z.number().int().nonnegative(), payment: z.string().min(2), items: z.array(z.object({ productId: z.number().int().optional(), productName: z.string(), price: z.number().int(), quantity: z.number().int().positive() })).min(1) })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const existingBuyer = await getBuyerProfile(whatsapp);
      if (existingBuyer?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun pembeli diblokir oleh Admin PASARKU." });
      const orderCode = `INV-${Date.now()}`;
      const shipping = await getShippingSettings();
      const productRowsForShipping = input.items.every((item) => item.productId !== undefined)
        ? await Promise.all(input.items.map((item) => db.select({ sellerId: products.sellerId, freeShipping: sellerProfiles.freeShipping }).from(products).leftJoin(sellerProfiles, eq(products.sellerId, sellerProfiles.id)).where(eq(products.id, item.productId as number)).limit(1)))
        : [];
      const freeShipping = productRowsForShipping.length === input.items.length && productRowsForShipping.every((rows) => rows[0]?.freeShipping === 1);
      const calculatedDelivery = calculateShippingCost(shipping, input.currentLocation, freeShipping);
      const calculatedTotal = input.subtotal + calculatedDelivery;
      await db.insert(buyerProfiles).values({ name: input.customerName, whatsapp, village: input.village, address: input.address }).onDuplicateKeyUpdate({ set: { name: input.customerName, village: input.village, address: input.address, updatedAt: new Date() } });
      await upsertAccountRole(whatsapp, "buyer", input.customerName.trim());
      const result = await db.insert(orders).values({ orderCode, customerName: input.customerName, whatsapp, village: input.village, address: input.address, currentLocation: input.currentLocation || null, note: input.note, subtotal: input.subtotal, delivery: calculatedDelivery, total: calculatedTotal, payment: input.payment, status: "Menunggu" });
      const orderId = Number((result as any)[0]?.insertId ?? 0);
      await db.insert(orderItems).values(input.items.map(item => ({ orderId, productId: item.productId, productName: item.productName, price: item.price, quantity: item.quantity })));
      let assignedCourier: { whatsapp: string; name: string } | null = null;
      const hasProductIds = input.items.every((item) => item.productId !== undefined);
      if (hasProductIds) {
        const productRows = await Promise.all(input.items.map((item) => db.select({ sellerId: products.sellerId }).from(products).where(eq(products.id, item.productId as number)).limit(1)));
        const sellerIds = Array.from(new Set(productRows.map((rows) => rows[0]?.sellerId).filter((id): id is number => id !== null && id !== undefined)));
        if (sellerIds.length === 1 && productRows.every((rows) => rows[0])) {
          const seller = await db.select({ preferredCourierId: sellerProfiles.preferredCourierId }).from(sellerProfiles).where(eq(sellerProfiles.id, sellerIds[0])).limit(1);
          const preferredCourierId = seller[0]?.preferredCourierId;
          if (preferredCourierId) {
            const courier = await db.select({ id: courierProfiles.id, name: courierProfiles.name, whatsapp: courierProfiles.whatsapp }).from(courierProfiles).where(and(eq(courierProfiles.id, preferredCourierId), eq(courierProfiles.verificationStatus, "verified"), eq(courierProfiles.isBanned, 0))).limit(1);
            if (courier[0]) {
              await db.update(orders).set({ courierId: courier[0].id, status: "Menunggu", courierAcceptedAt: null }).where(eq(orders.id, orderId));
              assignedCourier = { whatsapp: courier[0].whatsapp, name: courier[0].name };
            }
          }
        }
      }
      if (assignedCourier) void notifyCourierAssignment(assignedCourier.whatsapp, orderCode, calculatedTotal, "otomatis");
      return getOrderWithItems(orderCode);
    }),
    orders: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listOrders(); }),
    dashboardStats: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return getDashboardStats(); }),
    adminShippingSettings: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return getShippingSettings(); }),
    updateShippingSettings: publicProcedure.input(z.object({ sessionToken: adminSessionToken, ratePerKm: z.number().int().min(0).max(1000000), discountPercent: z.number().int().min(0).max(100), originLatitude: z.string().regex(/^-?\d+(?:\.\d+)?$/), originLongitude: z.string().regex(/^-?\d+(?:\.\d+)?$/) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const latitude = Number(input.originLatitude); const longitude = Number(input.originLongitude); if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new TRPCError({ code: "BAD_REQUEST", message: "Koordinat titik pusat tidak valid." }); return saveShippingSettings({ ratePerKm: input.ratePerKm, discountPercent: input.discountPercent, originLatitude: input.originLatitude, originLongitude: input.originLongitude }); }),
    couriers: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listCouriers(); }),
    userDirectory: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return getAdminUserDirectory(); }),
    resetNonAdminData: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); return resetMarketplaceData(); }),
    manageUserAccess: publicProcedure.input(z.object({ sessionToken: adminSessionToken, role: z.enum(["buyer", "seller", "courier"]), id: z.number().int().positive(), action: z.enum(["ban", "unban"]) })).mutation(async ({ input }) => {
      await requireAdminSession(input.sessionToken);
      const db = await dbRequired();
      const isBanned = input.action === "ban" ? 1 : 0;
      const verificationStatus = input.action === "ban" ? "unverified" : "pending";
      if (input.role === "buyer") {
        const rows = await db.select().from(buyerProfiles).where(eq(buyerProfiles.id, input.id)).limit(1); if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Data pembeli tidak ditemukan." });
        await db.update(buyerProfiles).set({ isBanned, verificationStatus }).where(eq(buyerProfiles.id, input.id));
      } else if (input.role === "seller") {
        const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, input.id)).limit(1); if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Data toko tidak ditemukan." });
        await db.update(sellerProfiles).set({ isBanned, verificationStatus }).where(eq(sellerProfiles.id, input.id));
      } else {
        const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.id, input.id)).limit(1); if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Data kurir tidak ditemukan." });
        await db.update(courierProfiles).set({ isBanned, verificationStatus }).where(eq(courierProfiles.id, input.id));
      }
      return { success: true as const, action: input.action, verificationStatus };
    }),
    approveSeller: publicProcedure.input(z.object({ sessionToken: adminSessionToken, id: z.number().int().positive(), status: z.enum(["verified", "rejected"]) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const db = await dbRequired(); const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, input.id)).limit(1); const seller = rows[0]; if (!seller) throw new TRPCError({ code: "NOT_FOUND", message: "Pendaftaran penjual tidak ditemukan." }); await db.update(sellerProfiles).set({ verificationStatus: input.status, isBanned: 0, verifiedAt: input.status === "verified" ? new Date() : null }).where(eq(sellerProfiles.id, input.id)); const notification = await notifyVerificationResult(seller.whatsapp, "seller", input.status, seller.shopName); return { success: true as const, notificationSent: notification.sent }; }),
    approveCourier: publicProcedure.input(z.object({ sessionToken: adminSessionToken, id: z.number().int().positive(), status: z.enum(["verified", "rejected"]) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const db = await dbRequired(); const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.id, input.id)).limit(1); const courier = rows[0]; if (!courier) throw new TRPCError({ code: "NOT_FOUND", message: "Pendaftaran kurir tidak ditemukan." }); await db.update(courierProfiles).set({ verificationStatus: input.status, isBanned: 0, verifiedAt: input.status === "verified" ? new Date() : null }).where(eq(courierProfiles.id, input.id)); const notification = await notifyVerificationResult(courier.whatsapp, "courier", input.status, courier.name); return { success: true as const, notificationSent: notification.sent }; }),
    courierProfile: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => {
      const db = await dbRequired();
      const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      return rows[0]?.verificationStatus === "verified" && !rows[0].isBanned ? rows[0] : null;
    }),
    order: publicProcedure.input(z.object({ orderCode: z.string().min(3) })).query(({ input }) => getOrderWithItems(input.orderCode)),
    assignCourier: publicProcedure.input(z.object({ sessionToken: adminSessionToken, orderCode: z.string(), whatsapp: phone })).mutation(async ({ input }) => {
      await requireAdminSession(input.sessionToken); const db = await dbRequired();
      const courier = await db.select().from(courierProfiles).where(and(eq(courierProfiles.whatsapp, normalizePhone(input.whatsapp)), eq(courierProfiles.verificationStatus, "verified"), eq(courierProfiles.isBanned, 0))).limit(1);
      if (!courier[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Kurir belum terverifikasi atau sedang diblokir." });
      const order = await db.select({ total: orders.total }).from(orders).where(eq(orders.orderCode, input.orderCode)).limit(1);
      if (!order[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." });
      await db.update(orders).set({ courierId: courier[0].id, status: "Menunggu", courierAcceptedAt: null }).where(eq(orders.orderCode, input.orderCode));
      const notification = await notifyCourierAssignment(courier[0].whatsapp, input.orderCode, order[0].total, "Admin");
      return { success: true as const, courier: courier[0], notificationSent: notification.sent };
    }),
    courierOrders: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => { const db = await dbRequired(); const courier = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1); return courier[0]?.verificationStatus === "verified" && !courier[0].isBanned ? listCourierOrders(courier[0].id) : []; }),
    acceptCourierTask: publicProcedure.input(z.object({ whatsapp: phone, orderCode: z.string().min(3) })).mutation(async ({ input }) => {
      const db = await dbRequired();
      const courier = await db.select().from(courierProfiles).where(and(eq(courierProfiles.whatsapp, normalizePhone(input.whatsapp)), eq(courierProfiles.verificationStatus, "verified"), eq(courierProfiles.isBanned, 0))).limit(1);
      if (!courier[0]) throw new TRPCError({ code: "FORBIDDEN", message: "Kurir belum terverifikasi atau sedang diblokir." });
      const order = await db.select().from(orders).where(and(eq(orders.orderCode, input.orderCode), eq(orders.courierId, courier[0].id))).limit(1);
      if (!order[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Tugas tidak ditemukan untuk kurir ini." });
      if (order[0].status !== "Menunggu") throw new TRPCError({ code: "CONFLICT", message: "Tugas ini sudah diterima atau sudah diproses." });
      await db.update(orders).set({ status: "Diproses", courierAcceptedAt: new Date() }).where(eq(orders.id, order[0].id));
      return { success: true as const, orderCode: input.orderCode, status: "Diproses" as const };
    }),
    updateOrderStatus: publicProcedure.input(z.object({ orderCode: z.string(), status: z.enum(["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]) })).mutation(async ({ input }) => { const db = await dbRequired(); await db.update(orders).set({ status: input.status }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
    updateAdminOrderStatus: publicProcedure.input(z.object({ sessionToken: adminSessionToken, orderCode: z.string(), status: z.enum(["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const db = await dbRequired(); await db.update(orders).set({ status: input.status }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
    confirmDelivery: publicProcedure.input(z.object({ orderCode: z.string().min(3) })).mutation(async ({ input }) => { const db = await dbRequired(); await db.update(orders).set({ status: "Selesai" }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
  }),
});

export type AppRouter = typeof appRouter;

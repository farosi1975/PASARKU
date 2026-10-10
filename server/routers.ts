import { z } from "zod";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createSupportTicket, getAccountRoles, getAdminProfile, getAdminUserDirectory, getBuyerProfile, getDashboardStats, getDb, getOrderWithItems, getPublicStoreDetail, getSiteSettings, listAdminProfiles, listApprovedProducts, listOpenStores, listCourierOrders, listCouriers, listOrders, listSellerCouriers, listSellerOrders, listSellerProducts, listSupportTickets, recordVisitorVisit, resetMarketplaceData, deleteMarketplaceUser, listAdminAuditLogs, saveShippingSettings, saveSiteSettings, getShippingSettings, updateSupportTicketStatus, upsertAccountRole } from "./db";
import { adminProfiles, buyerProfiles, courierProfiles, orderItems, orders, products, sellerProfiles } from "./db-tables";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { sendFonnteMessage } from "./fonnte";
import { storageGetSignedUrl, storagePut, storagePutPrivate } from "./storage";
import { calculateShippingCost, parseCoordinates } from "../shared/shipping";

const phone = z.string().min(10).max(32);
const dbRequired = async () => { const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database belum tersedia." }); return db; };
const affectedRows = (result: unknown) => Number((result as any)?.rowCount ?? (result as any)?.[0]?.affectedRows ?? 0);
const deductStockForConfirmedOrder = async (tx: any, orderCode: string) => {
  const current = await tx.select({ id: orders.id, status: orders.status, stockDeductedAt: orders.stockDeductedAt }).from(orders).where(eq(orders.orderCode, orderCode)).limit(1);
  if (!current[0] || current[0].status !== "Diproses" || current[0].stockDeductedAt) return { deducted: false };
  const claimed = await tx.update(orders).set({ stockDeductedAt: new Date(), updatedAt: new Date() }).where(and(eq(orders.id, current[0].id), eq(orders.status, "Diproses"), isNull(orders.stockDeductedAt)));
  if (!affectedRows(claimed)) return { deducted: false };
  const items = await tx.select({ productId: orderItems.productId, quantity: orderItems.quantity, productName: orderItems.productName }).from(orderItems).where(eq(orderItems.orderId, current[0].id));
  for (const item of items) {
    if (!item.productId) continue;
    const updated = await tx.update(products).set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() }).where(and(eq(products.id, item.productId), gte(products.stock, item.quantity)));
    if (!affectedRows(updated)) throw new TRPCError({ code: "CONFLICT", message: `Stok ${item.productName} tidak mencukupi untuk konfirmasi pesanan.` });
  }
  return { deducted: true };
};
const restoreStockForCancelledOrder = async (tx: any, orderCode: string) => {
  const current = await tx.select({ id: orders.id, status: orders.status, stockDeductedAt: orders.stockDeductedAt, stockRestoredAt: orders.stockRestoredAt }).from(orders).where(eq(orders.orderCode, orderCode)).limit(1);
  if (!current[0] || current[0].status !== "Dibatalkan" || !current[0].stockDeductedAt || current[0].stockRestoredAt) return { restored: false };
  const claimed = await tx.update(orders).set({ stockRestoredAt: new Date(), updatedAt: new Date() }).where(and(eq(orders.id, current[0].id), eq(orders.status, "Dibatalkan"), isNull(orders.stockRestoredAt)));
  if (!affectedRows(claimed)) return { restored: false };
  const items = await tx.select({ productId: orderItems.productId, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, current[0].id));
  for (const item of items) {
    if (!item.productId) continue;
    await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: new Date() }).where(eq(products.id, item.productId));
  }
  return { restored: true };
};
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
const otpSignature = (payload: string) => createHmac("sha256", process.env.JWT_SECRET?.trim() || "pasarku-otp-development-secret").update(payload).digest("base64url");
const createOtpChallengeToken = (scope: "buyer" | "admin", whatsapp: string, otp: string) => {
  const payload = Buffer.from(JSON.stringify({ scope, whatsapp, otpHash: createHmac("sha256", process.env.JWT_SECRET?.trim() || "pasarku-otp-development-secret").update(otp).digest("hex"), expiresAt: Date.now() + OTP_TTL_MS })).toString("base64url");
  return `${payload}.${otpSignature(payload)}`;
};
const readOtpChallengeToken = (token?: string) => {
  try {
    if (!token) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = otpSignature(payload);
    if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { scope?: string; whatsapp?: string; otpHash?: string; expiresAt?: number };
    return value.expiresAt && value.expiresAt >= Date.now() ? value : null;
  } catch { return null; }
};
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
const uploadAvatar = async (whatsapp: string, imageData?: string) => {
  if (!imageData) return null;
  const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Avatar harus berupa JPG, PNG, atau WebP." });
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 2 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Ukuran avatar maksimal 2 MB." });
  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const stored = await storagePut(`pasarku/avatars/${whatsapp}.${extension}`, buffer, match[1]);
  return stored.url;
};
const uploadSiteImage = async (kind: "logo" | "banner" | "hero-background", imageData?: string) => {
  if (!imageData) return null;
  const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Aset harus berupa JPG, PNG, atau WebP." });
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 3 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Ukuran aset maksimal 3 MB." });
  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const stored = await storagePut(`pasarku/site/${kind}.${extension}`, buffer, match[1]);
  return stored.url;
};
const uploadIdentityPhoto = async (whatsapp: string, kind: "identity" | "selfie", imageData?: string) => {
  if (!imageData) return null;
  const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Foto identitas harus berupa JPG, PNG, atau WebP." });
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 3 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Ukuran setiap foto identitas maksimal 3 MB." });
  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  return storagePutPrivate(`pasarku/identity/${whatsapp}/${kind}.${extension}`, buffer, match[1]);
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
const notifyAdminNewOrder = async (target: string, orderCode: string, customerName: string, village: string, total: number) => {
  const message = `PASARKU: Pesanan baru ${orderCode} dari ${customerName}, Desa ${village}. Total COD: Rp${total.toLocaleString("id-ID")}. Silakan buka panel Admin untuk memproses pesanan.`;
  try {
    await sendFonnteMessage(target, message);
    return { sent: true as const };
  } catch (error) {
    console.error("[FONNTE] Notifikasi pesanan baru ke Admin gagal:", error instanceof Error ? error.message : error);
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
    openStores: publicProcedure.query(() => listOpenStores()),
    storeDetail: publicProcedure.input(z.object({ sellerId: z.number().int().positive() })).query(({ input }) => getPublicStoreDetail(input.sellerId)),
    recordVisit: publicProcedure.mutation(() => recordVisitorVisit()),
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
      return { success: true, expiresIn: 300, challengeToken: createOtpChallengeToken("buyer", whatsapp, otp) } as const;
    }),
    verifyBuyerOtp: publicProcedure.input(z.object({ whatsapp: phone, otp: z.string().regex(/^\d{6}$/), challengeToken: z.string().min(20).optional() })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      const token = readOtpChallengeToken(input.challengeToken);
      const challenge = buyerChallenges.get(whatsapp) ?? { otp: "", name: undefined, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 };
      if (input.challengeToken && (!token || token.scope !== "buyer" || token.whatsapp !== whatsapp || !token.otpHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP belum benar atau sudah kedaluwarsa. Minta OTP baru." });
      if (!input.challengeToken && (!buyerChallenges.has(whatsapp) || challenge.expiresAt < Date.now())) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP belum benar atau sudah kedaluwarsa. Minta OTP baru." });
      const submittedHash = createHmac("sha256", process.env.JWT_SECRET?.trim() || "pasarku-otp-development-secret").update(input.otp).digest("hex");
      if ((input.challengeToken ? submittedHash !== token?.otpHash : challenge.otp !== input.otp)) { const error = invalidOtp(challenge, "OTP belum benar."); if (challenge.attempts >= OTP_MAX_ATTEMPTS) buyerChallenges.delete(whatsapp); throw error; }
      try {
        const existing = await getBuyerProfile(whatsapp);
        if (existing?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun pembeli diblokir oleh Admin PASARKU." });
        const displayName = existing?.name || challenge.name || `Warga ${whatsapp.slice(-4)}`;
        if (!existing) {
          const db = await dbRequired();
          await db.insert(buyerProfiles).values({ name: displayName, whatsapp, village: "Sawahan", address: "", verificationStatus: "verified", isBanned: 0 });
        }
        await upsertAccountRole(whatsapp, "buyer", displayName);
        // Consume the challenge only after profile and multi-role sync succeed.
        buyerChallenges.delete(whatsapp);
        return { name: displayName, whatsapp };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[OTP] Sinkronisasi profil pembeli setelah verifikasi gagal:", error instanceof Error ? error.message : error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kode OTP benar, tetapi profil belum dapat disinkronkan. Silakan tekan Verifikasi lagi." });
      }
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
      return { success: true, expiresIn: 300, challengeToken: createOtpChallengeToken("admin", whatsapp, otp) } as const;
    }),
    verifyAdminOtp: publicProcedure.input(z.object({ whatsapp: phone, otp: z.string().regex(/^\d{6}$/), challengeToken: z.string().min(20).optional() })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      const token = readOtpChallengeToken(input.challengeToken);
      const challenge = adminChallenges.get(whatsapp) ?? { otp: "", expiresAt: Date.now() + OTP_TTL_MS, attempts: 0 };
      if (input.challengeToken && (!token || token.scope !== "admin" || token.whatsapp !== whatsapp || !token.otpHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP admin tidak valid atau sudah kedaluwarsa. Minta OTP baru." });
      if (!input.challengeToken && (!adminChallenges.has(whatsapp) || challenge.expiresAt < Date.now())) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP admin tidak valid atau sudah kedaluwarsa. Minta OTP baru." });
      const submittedHash = createHmac("sha256", process.env.JWT_SECRET?.trim() || "pasarku-otp-development-secret").update(input.otp).digest("hex");
      if ((input.challengeToken ? submittedHash !== token?.otpHash : challenge.otp !== input.otp)) { const error = invalidOtp(challenge, "OTP admin tidak valid."); if (challenge.attempts >= OTP_MAX_ATTEMPTS) adminChallenges.delete(whatsapp); throw error; }
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
      await db.insert(adminProfiles).values({ name: input.name.trim(), whatsapp, verifiedAt: new Date() }).onConflictDoUpdate({ target: adminProfiles.whatsapp, set: { name: input.name.trim(), verifiedAt: new Date() } });
      return getAdminProfile(whatsapp);
    }),
    sellerProfile: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => {
      const db = await dbRequired();
      const rows = await db.select({ id: sellerProfiles.id, shopName: sellerProfiles.shopName, ownerName: sellerProfiles.ownerName, whatsapp: sellerProfiles.whatsapp, avatarUrl: sellerProfiles.avatarUrl, village: sellerProfiles.village, address: sellerProfiles.address, currentLocation: sellerProfiles.currentLocation, openingTime: sellerProfiles.openingTime, closingTime: sellerProfiles.closingTime, preferredCourierId: sellerProfiles.preferredCourierId, isOpen: sellerProfiles.isOpen, freeShipping: sellerProfiles.freeShipping, verificationStatus: sellerProfiles.verificationStatus, isBanned: sellerProfiles.isBanned, verifiedAt: sellerProfiles.verifiedAt }).from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      return rows[0] ?? null;
    }),
    setSellerOpen: publicProcedure.input(z.object({ whatsapp: phone, isOpen: z.boolean() })).mutation(async ({ input }) => {
      const db = await dbRequired();
      const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      await db.update(sellerProfiles).set({ isOpen: input.isOpen ? 1 : 0, updatedAt: new Date() }).where(eq(sellerProfiles.id, seller[0].id));
      return { isOpen: input.isOpen } as const;
    }),
    setSellerLocation: publicProcedure.input(z.object({ whatsapp: phone, currentLocation: z.string().regex(/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/) })).mutation(async ({ input }) => {
      const db = await dbRequired();
      const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      await db.update(sellerProfiles).set({ currentLocation: input.currentLocation, updatedAt: new Date() }).where(eq(sellerProfiles.id, seller[0].id));
      return { currentLocation: input.currentLocation } as const;
    }),
    setSellerHours: publicProcedure.input(z.object({ whatsapp: phone, openingTime: z.string().regex(/^\d{2}:\d{2}$/), closingTime: z.string().regex(/^\d{2}:\d{2}$/) })).mutation(async ({ input }) => {
      const db = await dbRequired();
      const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      await db.update(sellerProfiles).set({ openingTime: input.openingTime, closingTime: input.closingTime, updatedAt: new Date() }).where(eq(sellerProfiles.id, seller[0].id));
      return { openingTime: input.openingTime, closingTime: input.closingTime } as const;
    }),
    setSellerFreeShipping: publicProcedure.input(z.object({ whatsapp: phone, freeShipping: z.boolean() })).mutation(async ({ input }) => {
      const db = await dbRequired();
      const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      await db.update(sellerProfiles).set({ freeShipping: input.freeShipping ? 1 : 0, updatedAt: new Date() }).where(eq(sellerProfiles.id, seller[0].id));
      return { freeShipping: input.freeShipping } as const;
    }),
    updateSellerProfile: publicProcedure.input(z.object({ whatsapp: phone, shopName: z.string().min(2).max(160), ownerName: z.string().min(2).max(160), village: z.string().min(2).max(80), address: z.string().max(500).optional(), avatarData: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1);
      if (!seller[0] || seller[0].verificationStatus !== "verified" || seller[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil penjual belum terverifikasi." });
      const avatarUrl = input.avatarData ? await uploadAvatar(whatsapp, input.avatarData) : seller[0].avatarUrl;
      await db.update(sellerProfiles).set({ shopName: input.shopName.trim(), ownerName: input.ownerName.trim(), village: input.village, address: input.address?.trim() || null, avatarUrl, updatedAt: new Date() }).where(eq(sellerProfiles.id, seller[0].id));
      const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, seller[0].id)).limit(1); return rows[0];
    }),
    shippingSettings: publicProcedure.query(() => getShippingSettings()),
    siteSettings: publicProcedure.query(() => getSiteSettings()),
    createSupportTicket: publicProcedure.input(z.object({ customerName: z.string().min(2).max(160), whatsapp: phone, context: z.string().min(2).max(180), message: z.string().min(3).max(2000) })).mutation(async ({ input }) => {
      const ticketCode = `TKT-${Date.now()}-${randomInt(100, 1000)}`;
      return createSupportTicket({ ticketCode, customerName: input.customerName.trim(), whatsapp: normalizePhone(input.whatsapp), context: input.context.trim(), message: input.message.trim() });
    }),

    sellerProducts: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => listSellerProducts(input.whatsapp)),
    sellerOrders: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => listSellerOrders(input.whatsapp)),
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
      const db = await dbRequired(); await db.insert(sellerProfiles).values({ shopName: challenge.shopName, ownerName: challenge.ownerName, whatsapp, village: challenge.village, verificationStatus: "verified", verifiedAt: new Date() }).onConflictDoUpdate({ target: sellerProfiles.whatsapp, set: { shopName: challenge.shopName, ownerName: challenge.ownerName, village: challenge.village, verificationStatus: "verified", verifiedAt: new Date() } });
      sellerChallenges.delete(whatsapp); const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1); await upsertAccountRole(whatsapp, "seller", challenge.ownerName); return rows[0];
    }),
    registerSeller: publicProcedure.input(z.object({ shopName: z.string().min(2), ownerName: z.string().min(2), whatsapp: phone, village: z.string().min(2), identityPhotoData: z.string().optional(), selfiePhotoData: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const existing = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1); if (existing[0]?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun toko ini diblokir oleh Admin PASARKU." });
      if (!input.identityPhotoData || !input.selfiePhotoData) throw new TRPCError({ code: "BAD_REQUEST", message: "Foto KTP/identitas dan selfie wajib diunggah untuk verifikasi Admin." });
      const identityPhoto = await uploadIdentityPhoto(whatsapp, "identity", input.identityPhotoData); const selfiePhoto = await uploadIdentityPhoto(whatsapp, "selfie", input.selfiePhotoData);
      const identityPhotoUrl = identityPhoto?.url ?? null; const selfiePhotoUrl = selfiePhoto?.url ?? null; const identityPhotoKey = identityPhoto?.key ?? null; const selfiePhotoKey = selfiePhoto?.key ?? null;
      await db.insert(sellerProfiles).values({ shopName: input.shopName.trim(), ownerName: input.ownerName.trim(), whatsapp, identityPhotoUrl, selfiePhotoUrl, identityPhotoKey, selfiePhotoKey, village: input.village, verificationStatus: "pending", documentsReviewedAt: null, verifiedAt: null }).onConflictDoUpdate({ target: sellerProfiles.whatsapp, set: { shopName: input.shopName.trim(), ownerName: input.ownerName.trim(), village: input.village, identityPhotoUrl, selfiePhotoUrl, identityPhotoKey, selfiePhotoKey, verificationStatus: "pending", documentsReviewedAt: null, verifiedAt: null, updatedAt: new Date() } });
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
      const db = await dbRequired(); await db.insert(courierProfiles).values({ name: challenge.name, whatsapp, vehicle: challenge.vehicle, verificationStatus: "verified", verifiedAt: new Date() }).onConflictDoUpdate({ target: courierProfiles.whatsapp, set: { name: challenge.name, vehicle: challenge.vehicle, verificationStatus: "verified", verifiedAt: new Date() } });
      courierChallenges.delete(whatsapp); const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, whatsapp)).limit(1); await upsertAccountRole(whatsapp, "courier", challenge.name); return rows[0];
    }),
    registerCourier: publicProcedure.input(z.object({ name: z.string().min(2), whatsapp: phone, vehicle: z.string().min(2), village: z.string().min(2).default("Sawahan"), address: z.string().optional(), identityPhotoData: z.string().optional(), selfiePhotoData: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const existing = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, whatsapp)).limit(1); if (existing[0]?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun kurir ini diblokir oleh Admin PASARKU." });
      if (!input.identityPhotoData || !input.selfiePhotoData) throw new TRPCError({ code: "BAD_REQUEST", message: "Foto KTP/identitas dan selfie wajib diunggah untuk verifikasi Admin." });
      const identityPhoto = await uploadIdentityPhoto(whatsapp, "identity", input.identityPhotoData); const selfiePhoto = await uploadIdentityPhoto(whatsapp, "selfie", input.selfiePhotoData);
      const identityPhotoUrl = identityPhoto?.url ?? null; const selfiePhotoUrl = selfiePhoto?.url ?? null; const identityPhotoKey = identityPhoto?.key ?? null; const selfiePhotoKey = selfiePhoto?.key ?? null;
      await db.insert(courierProfiles).values({ name: input.name.trim(), whatsapp, identityPhotoUrl, selfiePhotoUrl, identityPhotoKey, selfiePhotoKey, vehicle: input.vehicle, village: input.village, address: input.address?.trim() || null, verificationStatus: "pending", documentsReviewedAt: null, verifiedAt: null }).onConflictDoUpdate({ target: courierProfiles.whatsapp, set: { name: input.name.trim(), vehicle: input.vehicle, village: input.village, address: input.address?.trim() || null, identityPhotoUrl, selfiePhotoUrl, identityPhotoKey, selfiePhotoKey, verificationStatus: "pending", documentsReviewedAt: null, verifiedAt: null, updatedAt: new Date() } });
      await upsertAccountRole(whatsapp, "courier", input.name.trim());
      const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, whatsapp)).limit(1); return rows[0];
    }),
    buyerProfile: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => getBuyerProfile(normalizePhone(input.whatsapp))),
    accountRoles: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => getAccountRoles(normalizePhone(input.whatsapp))),
    saveBuyerProfile: publicProcedure.input(z.object({ name: z.string().min(2), whatsapp: phone, village: z.string().min(2), address: z.string().optional(), avatarData: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const existing = await getBuyerProfile(whatsapp); if (existing?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun pembeli diblokir oleh Admin PASARKU." });
      const avatarUrl = input.avatarData ? await uploadAvatar(whatsapp, input.avatarData) : existing?.avatarUrl ?? null;
      await db.insert(buyerProfiles).values({ name: input.name, whatsapp, village: input.village, address: input.address ?? null, avatarUrl }).onConflictDoUpdate({ target: buyerProfiles.whatsapp, set: { name: input.name, village: input.village, address: input.address ?? null, avatarUrl, updatedAt: new Date() } });
      await upsertAccountRole(whatsapp, "buyer", input.name.trim());
      return getBuyerProfile(whatsapp);
    }),
    createOrder: publicProcedure.input(z.object({ customerName: z.string().min(2), whatsapp: phone, village: z.string().min(2), address: z.string().min(3), currentLocation: z.string().max(180).optional(), pickupLocation: z.string().max(180).optional(), routeDistanceKm: z.number().positive().max(100).optional(), handlingFee: z.number().int().nonnegative().optional(), note: z.string().optional(), subtotal: z.number().int().nonnegative(), delivery: z.number().int().nonnegative(), total: z.number().int().nonnegative(), payment: z.string().min(2), items: z.array(z.object({ productId: z.number().int().optional(), productName: z.string(), price: z.number().int(), quantity: z.number().int().positive() })).min(1) })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const existingBuyer = await getBuyerProfile(whatsapp);
      if (existingBuyer?.isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Akun pembeli diblokir oleh Admin PASARKU." });
      const orderCode = `INV-${Date.now()}`;
      const shipping = await getShippingSettings();
      const productRowsForShipping = input.items.every((item) => item.productId !== undefined)
        ? await Promise.all(input.items.map((item) => db.select({ sellerId: products.sellerId, stock: products.stock, freeShipping: sellerProfiles.freeShipping, sellerLocation: sellerProfiles.currentLocation }).from(products).leftJoin(sellerProfiles, eq(products.sellerId, sellerProfiles.id)).where(eq(products.id, item.productId as number)).limit(1)))
        : [];
      if (input.items.every((item) => item.productId !== undefined)) {
        input.items.forEach((item, index) => {
          const product = productRowsForShipping[index]?.[0];
          if (!product) throw new TRPCError({ code: "NOT_FOUND", message: `Produk ${item.productName} tidak ditemukan.` });
          if (product.stock < item.quantity) throw new TRPCError({ code: "CONFLICT", message: `Stok ${item.productName} habis atau tidak mencukupi.` });
        });
      }
      const freeShipping = productRowsForShipping.length === input.items.length && productRowsForShipping.every((rows) => rows[0]?.freeShipping === 1);
      const pickupLocation = productRowsForShipping.length === input.items.length && productRowsForShipping.every((rows) => rows[0]) && new Set(productRowsForShipping.map((rows) => rows[0]?.sellerLocation || "")).size === 1 ? productRowsForShipping[0]?.[0]?.sellerLocation || null : null;
      const pickupCoordinates = parseCoordinates(pickupLocation);
      const sellerShipping = pickupCoordinates ? { ...shipping, originLatitude: String(pickupCoordinates.latitude), originLongitude: String(pickupCoordinates.longitude) } : shipping;
      const calculatedDelivery = calculateShippingCost(sellerShipping, input.currentLocation, freeShipping, input.routeDistanceKm);
      const calculatedHandlingFee = Math.round(input.subtotal * (shipping.handlingFeePercent || 0) / 100);
      const calculatedTotal = input.subtotal + calculatedHandlingFee + calculatedDelivery;
      await db.insert(buyerProfiles).values({ name: input.customerName, whatsapp, village: input.village, address: input.address }).onConflictDoUpdate({ target: buyerProfiles.whatsapp, set: { name: input.customerName, village: input.village, address: input.address, updatedAt: new Date() } });
      await upsertAccountRole(whatsapp, "buyer", input.customerName.trim());
      await db.insert(orders).values({ orderCode, customerName: input.customerName, whatsapp, village: input.village, address: input.address, currentLocation: input.currentLocation || null, pickupLocation, routeDistanceKm: input.routeDistanceKm ? Math.round(input.routeDistanceKm * 10) : null, note: input.note, subtotal: input.subtotal, handlingFee: calculatedHandlingFee, delivery: calculatedDelivery, total: calculatedTotal, payment: input.payment, status: "Menunggu" });
      const insertedOrder = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderCode, orderCode)).limit(1);
      const orderId = insertedOrder[0]?.id;
      if (!orderId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Pesanan tersimpan tetapi ID pesanan tidak dapat dibaca." });
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
      const adminSettings = await getShippingSettings();
      void notifyAdminNewOrder(adminSettings.adminWhatsapp, orderCode, input.customerName, input.village, calculatedTotal);
      if (assignedCourier) void notifyCourierAssignment(assignedCourier.whatsapp, orderCode, calculatedTotal, "otomatis");
      return getOrderWithItems(orderCode);
    }),
    orders: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listOrders(); }),
    dashboardStats: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return getDashboardStats(); }),
    adminShippingSettings: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return getShippingSettings(); }),
    adminSiteSettings: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return getSiteSettings(); }),
    updateSiteSettings: publicProcedure.input(z.object({ sessionToken: adminSessionToken, brandName: z.string().trim().min(2).max(80), tagline: z.string().trim().min(2).max(180), heroTitle: z.string().trim().min(2).max(180), heroHighlight: z.string().trim().min(2).max(180), heroDescription: z.string().trim().min(2).max(1000), promoTitle: z.string().trim().min(2).max(160), promoDescription: z.string().trim().min(2).max(1000), promoCta: z.string().trim().min(2).max(80), promoActive: z.boolean(), promoColor: z.enum(["orange", "purple", "green"]), promoSlots: z.string().max(30000).optional(), logoData: z.string().optional(), bannerImageData: z.string().optional(), heroBackgroundData: z.string().optional(), clearLogo: z.boolean().optional(), clearBanner: z.boolean().optional(), clearHeroBackground: z.boolean().optional(), heroBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), heroOverlayColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), heroOverlayOpacity: z.number().int().min(0).max(85), heroBackgroundPosition: z.enum(["center", "top", "bottom"]), promoStartsAt: z.string().datetime().nullable().optional(), promoEndsAt: z.string().datetime().nullable().optional() })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); if (input.promoStartsAt && input.promoEndsAt && new Date(input.promoEndsAt) <= new Date(input.promoStartsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "Waktu berakhir promo harus setelah waktu mulai." }); if (input.promoSlots) { try { const slots = JSON.parse(input.promoSlots); if (!Array.isArray(slots) || slots.length > 6) throw new Error(); for (const slot of slots) { if (typeof slot.title !== "string" || typeof slot.description !== "string") throw new Error(); if (slot.startsAt && slot.endsAt && new Date(slot.endsAt) <= new Date(slot.startsAt)) throw new Error(); } } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Slot promo tidak valid atau jadwal berakhir sebelum dimulai." }); } } const [logoUrl, bannerImageUrl, heroBackgroundUrl] = await Promise.all([uploadSiteImage("logo", input.logoData), uploadSiteImage("banner", input.bannerImageData), uploadSiteImage("hero-background", input.heroBackgroundData)]); return saveSiteSettings({ brandName: input.brandName, tagline: input.tagline, heroTitle: input.heroTitle, heroHighlight: input.heroHighlight, heroDescription: input.heroDescription, heroBackgroundColor: input.heroBackgroundColor, heroOverlayColor: input.heroOverlayColor, heroOverlayOpacity: input.heroOverlayOpacity, heroBackgroundPosition: input.heroBackgroundPosition, promoTitle: input.promoTitle, promoDescription: input.promoDescription, promoCta: input.promoCta, promoActive: input.promoActive ? 1 : 0, promoColor: input.promoColor, promoSlots: input.promoSlots, ...(logoUrl ? { logoUrl } : input.clearLogo ? { logoUrl: null } : {}), ...(bannerImageUrl ? { bannerImageUrl } : input.clearBanner ? { bannerImageUrl: null } : {}), ...(heroBackgroundUrl ? { heroBackgroundUrl } : input.clearHeroBackground ? { heroBackgroundUrl: null } : {}), promoStartsAt: input.promoStartsAt ? new Date(input.promoStartsAt) : null, promoEndsAt: input.promoEndsAt ? new Date(input.promoEndsAt) : null }); }),
    updateShippingSettings: publicProcedure.input(z.object({ sessionToken: adminSessionToken, ratePerKm: z.number().int().min(0).max(1000000), discountPercent: z.number().int().min(0).max(100), handlingFeePercent: z.number().int().min(0).max(100), originLatitude: z.string().regex(/^-?\d+(?:\.\d+)?$/), originLongitude: z.string().regex(/^-?\d+(?:\.\d+)?$/), adminWhatsapp: phone, supportOpeningTime: z.string().regex(/^\d{2}:\d{2}$/), supportClosingTime: z.string().regex(/^\d{2}:\d{2}$/) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const latitude = Number(input.originLatitude); const longitude = Number(input.originLongitude); const adminWhatsapp = normalizePhone(input.adminWhatsapp); if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new TRPCError({ code: "BAD_REQUEST", message: "Koordinat titik pusat tidak valid." }); return saveShippingSettings({ ratePerKm: input.ratePerKm, discountPercent: input.discountPercent, handlingFeePercent: input.handlingFeePercent, originLatitude: input.originLatitude, originLongitude: input.originLongitude, adminWhatsapp, supportOpeningTime: input.supportOpeningTime, supportClosingTime: input.supportClosingTime }); }),
    supportTickets: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listSupportTickets(); }),
    updateSupportTicket: publicProcedure.input(z.object({ sessionToken: adminSessionToken, id: z.number().int().positive(), status: z.enum(["open", "in_progress", "resolved"]) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); return updateSupportTicketStatus(input.id, input.status); }),
    couriers: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listCouriers(); }),
    userDirectory: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return getAdminUserDirectory(); }),
    auditLogs: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listAdminAuditLogs(); }),
    adminPhotoUrl: publicProcedure.input(z.object({ sessionToken: adminSessionToken, role: z.enum(["seller", "courier"]), id: z.number().int().positive(), kind: z.enum(["identity", "selfie"]) })).query(async ({ input }) => {
      await requireAdminSession(input.sessionToken);
      const db = await dbRequired();
      if (input.role === "seller") {
        const row = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, input.id)).limit(1);
        if (!row[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Profil penjual tidak ditemukan." });
        const key = input.kind === "identity" ? row[0].identityPhotoKey : row[0].selfiePhotoKey;
        const legacyUrl = input.kind === "identity" ? row[0].identityPhotoUrl : row[0].selfiePhotoUrl;
        return { url: key ? await storageGetSignedUrl(key) : legacyUrl };
      }
      const row = await db.select().from(courierProfiles).where(eq(courierProfiles.id, input.id)).limit(1);
      if (!row[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Profil kurir tidak ditemukan." });
      const key = input.kind === "identity" ? row[0].identityPhotoKey : row[0].selfiePhotoKey;
      const legacyUrl = input.kind === "identity" ? row[0].identityPhotoUrl : row[0].selfiePhotoUrl;
      return { url: key ? await storageGetSignedUrl(key) : legacyUrl };
    }),
    resetNonAdminData: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); return resetMarketplaceData(); }),
    deleteUser: publicProcedure.input(z.object({ sessionToken: adminSessionToken, role: z.enum(["buyer", "seller", "courier"]), id: z.number().int().positive() })).mutation(async ({ input }) => {
      const admin = await requireAdminSession(input.sessionToken);
      try { return await deleteMarketplaceUser(input.role, input.id, { name: admin.name, whatsapp: admin.whatsapp }); }
      catch (error) {
        if (error instanceof Error && /tidak ditemukan/i.test(error.message)) throw new TRPCError({ code: "NOT_FOUND", message: error.message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "User belum dapat dihapus." });
      }
    }),
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
    reviewDocuments: publicProcedure.input(z.object({ sessionToken: adminSessionToken, role: z.enum(["seller", "courier"]), id: z.number().int().positive(), reviewed: z.boolean() })).mutation(async ({ input }) => {
      await requireAdminSession(input.sessionToken);
      const db = await dbRequired();
      const reviewedAt = input.reviewed ? new Date() : null;
      if (input.role === "seller") {
        const rows = await db.select({ id: sellerProfiles.id }).from(sellerProfiles).where(eq(sellerProfiles.id, input.id)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Data toko tidak ditemukan." });
        await db.update(sellerProfiles).set({ documentsReviewedAt: reviewedAt, updatedAt: new Date() }).where(eq(sellerProfiles.id, input.id));
      } else {
        const rows = await db.select({ id: courierProfiles.id }).from(courierProfiles).where(eq(courierProfiles.id, input.id)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Data kurir tidak ditemukan." });
        await db.update(courierProfiles).set({ documentsReviewedAt: reviewedAt, updatedAt: new Date() }).where(eq(courierProfiles.id, input.id));
      }
      return { success: true as const, reviewed: input.reviewed, reviewedAt };
    }),
    approveSeller: publicProcedure.input(z.object({ sessionToken: adminSessionToken, id: z.number().int().positive(), status: z.enum(["verified", "rejected"]) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const db = await dbRequired(); const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, input.id)).limit(1); const seller = rows[0]; if (!seller) throw new TRPCError({ code: "NOT_FOUND", message: "Pendaftaran penjual tidak ditemukan." }); await db.update(sellerProfiles).set({ verificationStatus: input.status, isBanned: 0, verifiedAt: input.status === "verified" ? new Date() : null }).where(eq(sellerProfiles.id, input.id)); const notification = await notifyVerificationResult(seller.whatsapp, "seller", input.status, seller.shopName); return { success: true as const, notificationSent: notification.sent }; }),
    approveCourier: publicProcedure.input(z.object({ sessionToken: adminSessionToken, id: z.number().int().positive(), status: z.enum(["verified", "rejected"]) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const db = await dbRequired(); const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.id, input.id)).limit(1); const courier = rows[0]; if (!courier) throw new TRPCError({ code: "NOT_FOUND", message: "Pendaftaran kurir tidak ditemukan." }); await db.update(courierProfiles).set({ verificationStatus: input.status, isBanned: 0, verifiedAt: input.status === "verified" ? new Date() : null }).where(eq(courierProfiles.id, input.id)); const notification = await notifyVerificationResult(courier.whatsapp, "courier", input.status, courier.name); return { success: true as const, notificationSent: notification.sent }; }),
    courierProfile: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => {
      const db = await dbRequired();
      const rows = await db.select({ id: courierProfiles.id, name: courierProfiles.name, whatsapp: courierProfiles.whatsapp, avatarUrl: courierProfiles.avatarUrl, vehicle: courierProfiles.vehicle, village: courierProfiles.village, address: courierProfiles.address, verificationStatus: courierProfiles.verificationStatus, isBanned: courierProfiles.isBanned, verifiedAt: courierProfiles.verifiedAt }).from(courierProfiles).where(eq(courierProfiles.whatsapp, normalizePhone(input.whatsapp))).limit(1);
      return rows[0]?.verificationStatus === "verified" && !rows[0].isBanned ? rows[0] : null;
    }),
    updateCourierProfile: publicProcedure.input(z.object({ whatsapp: phone, name: z.string().min(2).max(160), vehicle: z.string().min(2).max(40), village: z.string().min(2).max(80), address: z.string().max(500).optional(), avatarData: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const whatsapp = normalizePhone(input.whatsapp); const courier = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, whatsapp)).limit(1);
      if (!courier[0] || courier[0].verificationStatus !== "verified" || courier[0].isBanned) throw new TRPCError({ code: "FORBIDDEN", message: "Profil kurir belum terverifikasi." });
      const avatarUrl = input.avatarData ? await uploadAvatar(whatsapp, input.avatarData) : courier[0].avatarUrl;
      await db.update(courierProfiles).set({ name: input.name.trim(), vehicle: input.vehicle, village: input.village, address: input.address?.trim() || null, avatarUrl, updatedAt: new Date() }).where(eq(courierProfiles.id, courier[0].id));
      const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.id, courier[0].id)).limit(1); return rows[0];
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
    updateAdminOrderStatus: publicProcedure.input(z.object({ sessionToken: adminSessionToken, orderCode: z.string(), status: z.enum(["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const db = await dbRequired(); if (input.status === "Diproses" || input.status === "Dibatalkan") { await db.transaction(async (tx: any) => { await tx.update(orders).set({ status: input.status, updatedAt: new Date() }).where(eq(orders.orderCode, input.orderCode)); if (input.status === "Diproses") await deductStockForConfirmedOrder(tx, input.orderCode); else await restoreStockForCancelledOrder(tx, input.orderCode); }); } else { await db.update(orders).set({ status: input.status, updatedAt: new Date() }).where(eq(orders.orderCode, input.orderCode)); } return getOrderWithItems(input.orderCode); }),
    confirmDelivery: publicProcedure.input(z.object({ orderCode: z.string().min(3) })).mutation(async ({ input }) => { const db = await dbRequired(); await db.update(orders).set({ status: "Selesai" }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
  }),
});

export type AppRouter = typeof appRouter;

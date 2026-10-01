import { z } from "zod";
import { randomBytes, randomInt } from "node:crypto";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getAdminProfile, getBuyerProfile, getDashboardStats, getDb, getOrderWithItems, listAdminProfiles, listApprovedProducts, listCourierOrders, listCouriers, listOrders, listSellerProducts } from "./db";
import { adminProfiles, buyerProfiles, courierProfiles, orderItems, orders, products, sellerProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { sendFonnteMessage } from "./fonnte";

const phone = z.string().min(10).max(32);
const dbRequired = async () => { const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database belum tersedia." }); return db; };
const adminSessionToken = z.string().min(32).max(128);
const adminChallenges = new Map<string, { otp: string; expiresAt: number }>();
const adminSessions = new Map<string, { whatsapp: string; expiresAt: number }>();
const buyerChallenges = new Map<string, { otp: string; name?: string; expiresAt: number }>();
const normalizePhone = (value: string) => { const digits = value.replace(/\D/g, ""); return digits.startsWith("0") ? `62${digits.slice(1)}` : digits; };
const requireAdminSession = async (token: string) => {
  const session = adminSessions.get(token);
  if (!session || session.expiresAt < Date.now()) { adminSessions.delete(token); throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesi admin berakhir. Silakan masuk kembali." }); }
  const profile = await getAdminProfile(session.whatsapp);
  if (!profile) { adminSessions.delete(token); throw new TRPCError({ code: "FORBIDDEN", message: "Admin tidak terverifikasi." }); }
  return profile;
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
      const otp = String(randomInt(100000, 1000000));
      buyerChallenges.set(whatsapp, { otp, name: input.name?.trim(), expiresAt: Date.now() + 5 * 60 * 1000 });
      try {
        await sendFonnteMessage(whatsapp, `Kode OTP PASARKU: ${otp}. Berlaku 5 menit. Jangan bagikan kode ini.`);
      } catch (error) {
        buyerChallenges.delete(whatsapp);
        throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "OTP FONNTE gagal dikirim." });
      }
      return { success: true, expiresIn: 300 } as const;
    }),
    verifyBuyerOtp: publicProcedure.input(z.object({ whatsapp: phone, otp: z.string().regex(/^\d{6}$/) })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      const challenge = buyerChallenges.get(whatsapp);
      if (!challenge || challenge.expiresAt < Date.now() || challenge.otp !== input.otp) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP belum benar atau sudah kedaluwarsa." });
      buyerChallenges.delete(whatsapp);
      const existing = await getBuyerProfile(whatsapp);
      const displayName = existing?.name || challenge.name || `Warga ${whatsapp.slice(-4)}`;
      if (!existing) {
        const db = await dbRequired();
        await db.insert(buyerProfiles).values({ name: displayName, whatsapp, village: "Sawahan", address: "" });
      }
      return { name: displayName, whatsapp };
    }),
    requestAdminOtp: publicProcedure.input(z.object({ whatsapp: phone })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      const profile = await getAdminProfile(whatsapp);
      if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "Nomor belum terdaftar sebagai admin terverifikasi." });
      const otp = String(randomInt(100000, 1000000));
      adminChallenges.set(whatsapp, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
      try {
        await sendFonnteMessage(whatsapp, `Kode OTP Admin PASARKU: ${otp}. Berlaku 5 menit. Jangan bagikan kode ini.`);
      } catch (error) {
        adminChallenges.delete(whatsapp);
        throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "OTP FONNTE gagal dikirim." });
      }
      return { success: true, expiresIn: 300 } as const;
    }),
    verifyAdminOtp: publicProcedure.input(z.object({ whatsapp: phone, otp: z.string().regex(/^\d{6}$/) })).mutation(async ({ input }) => {
      const whatsapp = normalizePhone(input.whatsapp);
      const challenge = adminChallenges.get(whatsapp);
      if (!challenge || challenge.expiresAt < Date.now() || challenge.otp !== input.otp) throw new TRPCError({ code: "UNAUTHORIZED", message: "OTP admin tidak valid atau sudah kedaluwarsa." });
      const profile = await getAdminProfile(whatsapp);
      if (!profile) throw new TRPCError({ code: "FORBIDDEN", message: "Admin tidak terverifikasi." });
      adminChallenges.delete(whatsapp);
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
    sellerProducts: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => listSellerProducts(input.whatsapp)),
    registerSeller: publicProcedure.input(z.object({ shopName: z.string().min(2), ownerName: z.string().min(2), whatsapp: phone, village: z.string().min(2) })).mutation(async ({ input }) => {
      const db = await dbRequired();
      await db.insert(sellerProfiles).values({ ...input, verifiedAt: new Date() }).onDuplicateKeyUpdate({ set: { shopName: input.shopName, ownerName: input.ownerName, village: input.village, verifiedAt: new Date() } });
      const rows = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, input.whatsapp)).limit(1); return rows[0];
    }),
    createProduct: publicProcedure.input(z.object({ whatsapp: phone, name: z.string().min(2), category: z.string().min(2), price: z.number().int().positive(), stock: z.number().int().nonnegative() })).mutation(async ({ input }) => {
      const db = await dbRequired(); const seller = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, input.whatsapp)).limit(1); if (!seller[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Profil penjual belum terverifikasi." });
      const result = await db.insert(products).values({ sellerId: seller[0].id, name: input.name, category: input.category, price: input.price, stock: input.stock, vendor: seller[0].shopName, location: seller[0].village, status: "approved" });
      return { id: Number((result as any)[0]?.insertId ?? 0), status: "approved" as const };
    }),
    registerCourier: publicProcedure.input(z.object({ name: z.string().min(2), whatsapp: phone, vehicle: z.string().min(2) })).mutation(async ({ input }) => {
      const db = await dbRequired(); await db.insert(courierProfiles).values({ ...input, verifiedAt: new Date() }).onDuplicateKeyUpdate({ set: { name: input.name, vehicle: input.vehicle, verifiedAt: new Date() } });
      const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, input.whatsapp)).limit(1); return rows[0];
    }),
    buyerProfile: publicProcedure.input(z.object({ whatsapp: phone })).query(({ input }) => getBuyerProfile(input.whatsapp)),
    saveBuyerProfile: publicProcedure.input(z.object({ name: z.string().min(2), whatsapp: phone, village: z.string().min(2), address: z.string().optional() })).mutation(async ({ input }) => {
      const db = await dbRequired();
      await db.insert(buyerProfiles).values(input).onDuplicateKeyUpdate({ set: { name: input.name, village: input.village, address: input.address ?? null } });
      return getBuyerProfile(input.whatsapp);
    }),
    createOrder: publicProcedure.input(z.object({ customerName: z.string().min(2), whatsapp: phone, village: z.string().min(2), address: z.string().min(3), note: z.string().optional(), subtotal: z.number().int().nonnegative(), delivery: z.number().int().nonnegative(), total: z.number().int().nonnegative(), payment: z.string().min(2), items: z.array(z.object({ productId: z.number().int().optional(), productName: z.string(), price: z.number().int(), quantity: z.number().int().positive() })).min(1) })).mutation(async ({ input }) => {
      const db = await dbRequired(); const orderCode = `INV-${Date.now()}`; await db.insert(buyerProfiles).values({ name: input.customerName, whatsapp: input.whatsapp, village: input.village, address: input.address }).onDuplicateKeyUpdate({ set: { name: input.customerName, village: input.village, address: input.address } }); const result = await db.insert(orders).values({ orderCode, customerName: input.customerName, whatsapp: input.whatsapp, village: input.village, address: input.address, note: input.note, subtotal: input.subtotal, delivery: input.delivery, total: input.total, payment: input.payment, status: "Menunggu" }); const orderId = Number((result as any)[0]?.insertId ?? 0); await db.insert(orderItems).values(input.items.map(item => ({ orderId, productId: item.productId, productName: item.productName, price: item.price, quantity: item.quantity }))); return getOrderWithItems(orderCode);
    }),
    orders: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listOrders(); }),
    dashboardStats: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return getDashboardStats(); }),
    couriers: publicProcedure.input(z.object({ sessionToken: adminSessionToken })).query(async ({ input }) => { await requireAdminSession(input.sessionToken); return listCouriers(); }),
    courierProfile: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => {
      const db = await dbRequired();
      const rows = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, input.whatsapp)).limit(1);
      return rows[0] ?? null;
    }),
    order: publicProcedure.input(z.object({ orderCode: z.string().min(3) })).query(({ input }) => getOrderWithItems(input.orderCode)),
    assignCourier: publicProcedure.input(z.object({ sessionToken: adminSessionToken, orderCode: z.string(), whatsapp: phone })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const db = await dbRequired(); const courier = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, input.whatsapp)).limit(1); if (!courier[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Kurir belum terverifikasi." }); await db.update(orders).set({ courierId: courier[0].id, status: "Diproses" }).where(eq(orders.orderCode, input.orderCode)); return { success: true, courier: courier[0] }; }),
    courierOrders: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => { const db = await dbRequired(); const courier = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, input.whatsapp)).limit(1); return courier[0] ? listCourierOrders(courier[0].id) : []; }),
    updateOrderStatus: publicProcedure.input(z.object({ orderCode: z.string(), status: z.enum(["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]) })).mutation(async ({ input }) => { const db = await dbRequired(); await db.update(orders).set({ status: input.status }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
    updateAdminOrderStatus: publicProcedure.input(z.object({ sessionToken: adminSessionToken, orderCode: z.string(), status: z.enum(["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]) })).mutation(async ({ input }) => { await requireAdminSession(input.sessionToken); const db = await dbRequired(); await db.update(orders).set({ status: input.status }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
    confirmDelivery: publicProcedure.input(z.object({ orderCode: z.string().min(3) })).mutation(async ({ input }) => { const db = await dbRequired(); await db.update(orders).set({ status: "Selesai" }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
  }),
});

export type AppRouter = typeof appRouter;

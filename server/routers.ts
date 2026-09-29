import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getDashboardStats, getDb, getOrderWithItems, listApprovedProducts, listCourierOrders, listCouriers, listOrders, listSellerProducts } from "./db";
import { courierProfiles, orderItems, orders, products, sellerProfiles } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const phone = z.string().min(10).max(32);
const dbRequired = async () => { const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database belum tersedia." }); return db; };

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  marketplace: router({
    products: publicProcedure.query(() => listApprovedProducts()),
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
    createOrder: publicProcedure.input(z.object({ customerName: z.string().min(2), whatsapp: phone, village: z.string().min(2), address: z.string().min(3), note: z.string().optional(), subtotal: z.number().int().nonnegative(), delivery: z.number().int().nonnegative(), total: z.number().int().nonnegative(), payment: z.string().min(2), items: z.array(z.object({ productId: z.number().int().optional(), productName: z.string(), price: z.number().int(), quantity: z.number().int().positive() })).min(1) })).mutation(async ({ input }) => {
      const db = await dbRequired(); const orderCode = `INV-${Date.now()}`; const result = await db.insert(orders).values({ orderCode, customerName: input.customerName, whatsapp: input.whatsapp, village: input.village, address: input.address, note: input.note, subtotal: input.subtotal, delivery: input.delivery, total: input.total, payment: input.payment, status: "Menunggu" }); const orderId = Number((result as any)[0]?.insertId ?? 0); await db.insert(orderItems).values(input.items.map(item => ({ orderId, productId: item.productId, productName: item.productName, price: item.price, quantity: item.quantity }))); return getOrderWithItems(orderCode);
    }),
    orders: publicProcedure.query(() => listOrders()),
    dashboardStats: publicProcedure.query(() => getDashboardStats()),
    couriers: publicProcedure.query(() => listCouriers()),
    order: publicProcedure.input(z.object({ orderCode: z.string().min(3) })).query(({ input }) => getOrderWithItems(input.orderCode)),
    assignCourier: publicProcedure.input(z.object({ orderCode: z.string(), whatsapp: phone })).mutation(async ({ input }) => { const db = await dbRequired(); const courier = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, input.whatsapp)).limit(1); if (!courier[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Kurir belum terverifikasi." }); await db.update(orders).set({ courierId: courier[0].id, status: "Diproses" }).where(eq(orders.orderCode, input.orderCode)); return { success: true, courier: courier[0] }; }),
    courierOrders: publicProcedure.input(z.object({ whatsapp: phone })).query(async ({ input }) => { const db = await dbRequired(); const courier = await db.select().from(courierProfiles).where(eq(courierProfiles.whatsapp, input.whatsapp)).limit(1); return courier[0] ? listCourierOrders(courier[0].id) : []; }),
    updateOrderStatus: publicProcedure.input(z.object({ orderCode: z.string(), status: z.enum(["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]) })).mutation(async ({ input }) => { const db = await dbRequired(); await db.update(orders).set({ status: input.status }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
    confirmDelivery: publicProcedure.input(z.object({ orderCode: z.string().min(3) })).mutation(async ({ input }) => { const db = await dbRequired(); await db.update(orders).set({ status: "Selesai" }).where(eq(orders.orderCode, input.orderCode)); return getOrderWithItems(input.orderCode); }),
  }),
});

export type AppRouter = typeof appRouter;

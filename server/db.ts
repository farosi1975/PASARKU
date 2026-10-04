import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ENV } from "./_core/env";
import { InsertUser, adminProfiles, buyerProfiles, courierProfiles, orderItems, orders, products, sellerProfiles, userAccounts, users } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listApprovedProducts() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(products).where(eq(products.status, "approved")).orderBy(desc(products.createdAt));
}

export async function listSellerProducts(whatsapp: string) {
  const db = await getDb(); if (!db) return [];
  const sellers = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1);
  if (!sellers[0]) return [];
  return db.select().from(products).where(eq(products.sellerId, sellers[0].id)).orderBy(desc(products.createdAt));
}

export async function getBuyerProfile(whatsapp: string) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(buyerProfiles).where(eq(buyerProfiles.whatsapp, whatsapp)).limit(1);
  return rows[0] ?? null;
}

export async function listBuyerProfiles() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(buyerProfiles).orderBy(desc(buyerProfiles.updatedAt));
}

export async function getAdminProfile(whatsapp: string) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(adminProfiles).where(eq(adminProfiles.whatsapp, whatsapp)).limit(1);
  return rows[0] ?? null;
}

export async function listAdminProfiles() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(adminProfiles).orderBy(desc(adminProfiles.createdAt));
}

export async function upsertAccountRole(whatsapp: string, role: "buyer" | "seller" | "courier" | "admin", displayName: string) {
  const db = await getDb(); if (!db) return null;
  const roleField = { buyer: "isBuyer", seller: "isSeller", courier: "isCourier", admin: "isAdmin" }[role];
  await db.insert(userAccounts).values({ whatsapp, displayName, [roleField]: 1 }).onDuplicateKeyUpdate({ set: { displayName, [roleField]: 1, updatedAt: new Date() } });
  const rows = await db.select().from(userAccounts).where(eq(userAccounts.whatsapp, whatsapp)).limit(1);
  return rows[0] ?? null;
}

export async function getAccountRoles(whatsapp: string) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(userAccounts).where(eq(userAccounts.whatsapp, whatsapp)).limit(1);
  return rows[0] ?? null;
}

export async function listOrders() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function getOrderWithItems(orderCode: string) {
  const db = await getDb(); if (!db) return undefined;
  const found = await db.select().from(orders).where(eq(orders.orderCode, orderCode)).limit(1);
  if (!found[0]) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, found[0].id));
  return { ...found[0], items };
}

export async function listCourierOrders(courierId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(orders).where(eq(orders.courierId, courierId)).orderBy(desc(orders.createdAt));
}

export async function listCouriers() {
  const db = await getDb(); if (!db) return [];
  return db.select({ id: courierProfiles.id, name: courierProfiles.name, whatsapp: courierProfiles.whatsapp, vehicle: courierProfiles.vehicle }).from(courierProfiles).where(eq(courierProfiles.verificationStatus, "verified")).orderBy(courierProfiles.name);
}

export async function getAdminUserDirectory() {
  const db = await getDb();
  if (!db) return { buyers: [], sellers: [], couriers: [], pendingSellers: [], pendingCouriers: [] };
  const [buyers, sellers, couriers, orderRows, productRows] = await Promise.all([
    db.select().from(buyerProfiles).orderBy(desc(buyerProfiles.updatedAt)),
    db.select().from(sellerProfiles).orderBy(desc(sellerProfiles.updatedAt)),
    db.select().from(courierProfiles).orderBy(desc(courierProfiles.updatedAt)),
    db.select({ whatsapp: orders.whatsapp, orderCode: orders.orderCode, createdAt: orders.createdAt }).from(orders),
    db.select({ sellerId: products.sellerId }).from(products),
  ]);
  const orderCounts = new Map<string, { count: number; lastOrderCode: string | null }>();
  for (const order of orderRows) {
    const current = orderCounts.get(order.whatsapp) ?? { count: 0, lastOrderCode: null };
    current.count += 1;
    current.lastOrderCode = order.orderCode;
    orderCounts.set(order.whatsapp, current);
  }
  const productCounts = new Map<number, number>();
  for (const product of productRows) if (product.sellerId !== null) productCounts.set(product.sellerId, (productCounts.get(product.sellerId) ?? 0) + 1);
  return {
    buyers: buyers.map((buyer) => ({ ...buyer, orderCount: orderCounts.get(buyer.whatsapp)?.count ?? 0, lastOrderCode: orderCounts.get(buyer.whatsapp)?.lastOrderCode ?? null })),
    sellers: sellers.map((seller) => ({ ...seller, productCount: productCounts.get(seller.id) ?? 0 })),
    couriers: couriers.filter((courier) => courier.verificationStatus === "verified"),
    pendingSellers: sellers.filter((seller) => seller.verificationStatus === "pending"),
    pendingCouriers: couriers.filter((courier) => courier.verificationStatus === "pending"),
  };
}

export async function resetMarketplaceData() {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia.");
  await db.transaction(async (tx) => {
    await tx.delete(orderItems);
    await tx.delete(orders);
    await tx.delete(products);
    await tx.delete(buyerProfiles);
    await tx.delete(sellerProfiles);
    await tx.delete(courierProfiles);
    await tx.update(userAccounts).set({ isBuyer: 0, isSeller: 0, isCourier: 0 }).where(eq(userAccounts.isAdmin, 1));
    await tx.delete(userAccounts).where(eq(userAccounts.isAdmin, 0));
  });
  return { success: true as const };
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { activeOrders: 0, registeredStores: 0, readyCouriers: 0, revenue: 0 };
  const [orderRows, storeRows, courierRows] = await Promise.all([
    db.select({ status: orders.status, total: orders.total }).from(orders),
    db.select({ id: sellerProfiles.id, verificationStatus: sellerProfiles.verificationStatus }).from(sellerProfiles),
    db.select({ id: courierProfiles.id, verificationStatus: courierProfiles.verificationStatus }).from(courierProfiles),
  ]);
  return {
    activeOrders: orderRows.filter((order) => order.status !== "Selesai" && order.status !== "Dibatalkan").length,
    registeredStores: storeRows.filter((store) => store.verificationStatus === "verified").length,
    readyCouriers: courierRows.filter((courier) => courier.verificationStatus === "verified").length,
    revenue: orderRows.reduce((sum, order) => sum + order.total, 0),
  };
}

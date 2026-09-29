import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ENV } from "./_core/env";
import { InsertUser, courierProfiles, orderItems, orders, products, sellerProfiles, users } from "../drizzle/schema";

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
  return db.select({ id: courierProfiles.id, name: courierProfiles.name, whatsapp: courierProfiles.whatsapp, vehicle: courierProfiles.vehicle }).from(courierProfiles).orderBy(courierProfiles.name);
}

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMySql } from "drizzle-orm/mysql2";
import { Pool } from "pg";
import { createPool as createMySqlPool } from "mysql2/promise";
import { ENV } from "./_core/env";
import type { InsertUser } from "../drizzle/schema";
import { adminAuditLogs, adminProfiles, buyerProfiles, courierProfiles, orderItems, orders, products, sellerProfiles, shippingSettings, siteSettings, supportTickets, userAccounts, users, visitorStats, pushSubscriptions, promoNotificationLogs, promoNotificationDeliveries, taxCashEntries, databaseDialect } from "./db-tables";

let _pool: Pool | null = null;
let _mysqlPool: ReturnType<typeof createMySqlPool> | null = null;
type CompatibleDatabase = ReturnType<typeof drizzlePostgres>;
let _db: CompatibleDatabase | null = null;

const wrapMySqlQuery = (query: any): any => new Proxy(query, {
  get(target, property, receiver) {
    if (property === "onConflictDoUpdate") {
      return (config: { set: Record<string, unknown> }) => target.onDuplicateKeyUpdate({ set: config.set });
    }
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== "function") return value;
    return (...args: unknown[]) => wrapMySqlQuery(value.apply(target, args));
  },
});

const wrapMySqlDatabase = (database: any): CompatibleDatabase => new Proxy(database, {
  get(target, property, receiver) {
    if (property === "insert" || property === "update") {
      return (table: unknown) => wrapMySqlQuery(target[property](table));
    }
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as CompatibleDatabase;
const ensureMySqlRuntimeColumns = async () => {
  if (!_mysqlPool) return;
  for (const column of ["stockDeductedAt", "stockRestoredAt"]) {
    try { await _mysqlPool.query(`ALTER TABLE orders ADD COLUMN ${column} timestamp NULL`); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "ER_DUP_FIELDNAME") console.warn(`[Database] Kolom ${column} belum dapat disiapkan:`, error instanceof Error ? error.message : error);
    }
  }
  try { await _mysqlPool.query(`ALTER TABLE courier_profiles ADD COLUMN currentLocation text NULL`); }
  catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ER_DUP_FIELDNAME") console.warn("[Database] Kolom lokasi kurir belum dapat disiapkan:", error instanceof Error ? error.message : error);
  }
  try { await _mysqlPool.query(`ALTER TABLE seller_profiles ADD COLUMN district varchar(80) NOT NULL DEFAULT 'Sawahan'`); }
  catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "ER_DUP_FIELDNAME") console.warn("[Database] Kolom kecamatan toko belum dapat disiapkan:", error instanceof Error ? error.message : error);
  }
  try { await _mysqlPool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (id int auto_increment primary key, endpoint varchar(512) not null unique, p256dh text not null, auth text not null, userAgent varchar(500) null, createdAt timestamp not null default current_timestamp, updatedAt timestamp not null default current_timestamp)`); } catch (error) { console.warn("[Database] Tabel subscription push belum dapat disiapkan:", error instanceof Error ? error.message : error); }
  try { await _mysqlPool.query(`CREATE TABLE IF NOT EXISTS promo_notification_logs (id int auto_increment primary key, slotId varchar(120) not null unique, sentAt timestamp not null default current_timestamp)`); } catch (error) { console.warn("[Database] Tabel log promo belum dapat disiapkan:", error instanceof Error ? error.message : error); }
  try { await _mysqlPool.query(`CREATE TABLE IF NOT EXISTS promo_notification_deliveries (id int auto_increment primary key, slotId varchar(120) not null, endpoint varchar(512) not null, sentAt timestamp not null default current_timestamp, unique key promo_notification_deliveries_slot_endpoint_idx (slotId, endpoint))`); } catch (error) { console.warn("[Database] Tabel delivery promo belum dapat disiapkan:", error instanceof Error ? error.message : error); }
  try { await _mysqlPool.query(`CREATE TABLE IF NOT EXISTS whatsapp_registration_requests (id int auto_increment primary key, requestCode varchar(40) not null unique, whatsapp varchar(32) null, referralCode varchar(24) null, status varchar(20) not null default 'pending', expiresAt timestamp not null, createdAt timestamp not null default current_timestamp, updatedAt timestamp not null default current_timestamp)`); } catch (error) { console.warn("[Database] Tabel pendaftaran WhatsApp belum dapat disiapkan:", error instanceof Error ? error.message : error); }
  try { await _mysqlPool.query(`ALTER TABLE whatsapp_registration_requests ADD COLUMN referralCode varchar(24) NULL`); } catch (error) { const code = (error as { code?: string }).code; if (code !== "ER_DUP_FIELDNAME") console.warn("[Database] Kolom referral pendaftaran WhatsApp belum dapat disiapkan:", error instanceof Error ? error.message : error); }
  try { await _mysqlPool.query(`CREATE TABLE IF NOT EXISTS admin_audit_logs (id int auto_increment primary key, adminName varchar(160) not null, adminWhatsapp varchar(32) not null, action varchar(80) not null, targetRole varchar(20) not null, targetId int not null, targetName varchar(180) not null, details text null, createdAt timestamp not null default current_timestamp)`); } catch (error) { console.warn("[Database] Tabel audit Admin belum dapat disiapkan:", error instanceof Error ? error.message : error); }
  try { await _mysqlPool.query(`CREATE TABLE IF NOT EXISTS tax_cash_entries (id int auto_increment primary key, entryDate varchar(10) not null, voucherNo varchar(80) not null, category varchar(80) not null, description text not null, income int not null default 0, expense int not null default 0, pphStatus varchar(40) not null default 'Bukan Omzet', paymentStatus varchar(40) not null default 'Belum Dibayar', billingCode varchar(120) null, merchantName varchar(160) null, sourceType varchar(30) not null default 'manual', sourceId varchar(80) null, createdAt timestamp not null default current_timestamp, updatedAt timestamp not null default current_timestamp, unique key tax_cash_entries_source_idx (sourceType, sourceId))`); } catch (error) { console.warn("[Database] Tabel Buku Kas Pajak belum dapat disiapkan:", error instanceof Error ? error.message : error); }
  for (const column of ["referralCode varchar(24) NULL", "referredByCode varchar(24) NULL"]) {
    try { await _mysqlPool.query(`ALTER TABLE buyer_profiles ADD COLUMN ${column}`); }
    catch (error) { const code = (error as { code?: string }).code; if (code !== "ER_DUP_FIELDNAME") console.warn("[Database] Kolom referral pembeli belum dapat disiapkan:", error instanceof Error ? error.message : error); }
  }
  try { await _mysqlPool.query(`CREATE UNIQUE INDEX buyer_profiles_referralCode_idx ON buyer_profiles (referralCode)`); }
  catch (error) { const code = (error as { code?: string }).code; if (code !== "ER_DUP_KEYNAME" && code !== "ER_DUP_ENTRY") console.warn("[Database] Indeks kode referral pembeli belum dapat disiapkan:", error instanceof Error ? error.message : error); }
};

export async function getDb(): Promise<CompatibleDatabase | null> {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (databaseDialect === "mysql") {
        _mysqlPool = createMySqlPool(process.env.DATABASE_URL);
        _db = wrapMySqlDatabase(drizzleMySql(_mysqlPool));
        await ensureMySqlRuntimeColumns();
      } else {
        _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
        await _pool.query(`CREATE TABLE IF NOT EXISTS "push_subscriptions" ("id" serial PRIMARY KEY, "endpoint" text NOT NULL UNIQUE, "p256dh" text NOT NULL, "auth" text NOT NULL, "userAgent" text, "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL)`);
        await _pool.query(`CREATE TABLE IF NOT EXISTS "promo_notification_logs" ("id" serial PRIMARY KEY, "slotId" varchar(120) NOT NULL UNIQUE, "sentAt" timestamp DEFAULT now() NOT NULL)`);
        await _pool.query(`CREATE TABLE IF NOT EXISTS "promo_notification_deliveries" ("id" serial PRIMARY KEY, "slotId" varchar(120) NOT NULL, "endpoint" text NOT NULL, "sentAt" timestamp DEFAULT now() NOT NULL, CONSTRAINT "promo_notification_deliveries_slot_endpoint_idx" UNIQUE ("slotId", "endpoint"))`);
        await _pool.query(`CREATE TABLE IF NOT EXISTS "whatsapp_registration_requests" ("id" serial PRIMARY KEY, "requestCode" varchar(40) NOT NULL UNIQUE, "whatsapp" varchar(32), "referralCode" varchar(24), "status" varchar(20) DEFAULT 'pending' NOT NULL, "expiresAt" timestamp NOT NULL, "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL)`);
        await _pool.query(`ALTER TABLE "whatsapp_registration_requests" ADD COLUMN IF NOT EXISTS "referralCode" varchar(24)`);
        await _pool.query(`CREATE TABLE IF NOT EXISTS "admin_audit_logs" ("id" serial PRIMARY KEY, "adminName" varchar(160) NOT NULL, "adminWhatsapp" varchar(32) NOT NULL, "action" varchar(80) NOT NULL, "targetRole" varchar(20) NOT NULL, "targetId" integer NOT NULL, "targetName" varchar(180) NOT NULL, "details" text, "createdAt" timestamp DEFAULT now() NOT NULL)`);
        await _pool.query(`CREATE TABLE IF NOT EXISTS "tax_cash_entries" ("id" serial PRIMARY KEY, "entryDate" varchar(10) NOT NULL, "voucherNo" varchar(80) NOT NULL, "category" varchar(80) NOT NULL, "description" text NOT NULL, "income" integer DEFAULT 0 NOT NULL, "expense" integer DEFAULT 0 NOT NULL, "pphStatus" varchar(40) DEFAULT 'Bukan Omzet' NOT NULL, "paymentStatus" varchar(40) DEFAULT 'Belum Dibayar' NOT NULL, "billingCode" varchar(120), "merchantName" varchar(160), "sourceType" varchar(30) DEFAULT 'manual' NOT NULL, "sourceId" varchar(80), "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL, CONSTRAINT "tax_cash_entries_source_idx" UNIQUE ("sourceType", "sourceId"))`);
        await _pool.query(`ALTER TABLE "seller_profiles" ADD COLUMN IF NOT EXISTS "district" varchar(80) NOT NULL DEFAULT 'Sawahan'`);
        await _pool.query(`ALTER TABLE "buyer_profiles" ADD COLUMN IF NOT EXISTS "referralCode" varchar(24)`);
        await _pool.query(`ALTER TABLE "buyer_profiles" ADD COLUMN IF NOT EXISTS "referredByCode" varchar(24)`);
        await _pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "buyer_profiles_referralCode_idx" ON "buyer_profiles" ("referralCode")`);
        _db = drizzlePostgres(_pool);
      }
      console.info(`[Database] Connected using ${databaseDialect} adapter.`);
    } catch (error) { console.warn("[Database] Failed to connect:", error); _pool = null; _mysqlPool = null; _db = null; }
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
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listApprovedProducts() {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({ product: products, seller: sellerProfiles }).from(products).innerJoin(sellerProfiles, eq(products.sellerId, sellerProfiles.id)).where(and(eq(products.status, "approved"), eq(sellerProfiles.verificationStatus, "verified"), eq(sellerProfiles.isBanned, 0), eq(sellerProfiles.isOpen, 1))).orderBy(desc(products.createdAt));
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
  return rows.filter(({ seller }) => { const current = minutes(now); const opening = minutes(seller.openingTime); const closing = minutes(seller.closingTime); return opening <= closing ? current >= opening && current <= closing : current >= opening || current <= closing; }).map(({ product, seller }) => ({ ...product, sellerFreeShipping: Boolean(seller.freeShipping), sellerLocation: seller.currentLocation, sellerVillage: seller.village, sellerDistrict: seller.district, openingTime: seller.openingTime, closingTime: seller.closingTime }));
}

export async function listOpenStores() {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({ product: products, seller: sellerProfiles }).from(products).innerJoin(sellerProfiles, eq(products.sellerId, sellerProfiles.id)).where(and(eq(products.status, "approved"), eq(sellerProfiles.verificationStatus, "verified"), eq(sellerProfiles.isBanned, 0), eq(sellerProfiles.isOpen, 1))).orderBy(desc(products.createdAt));
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
  const openRows = rows.filter(({ seller }) => { const current = minutes(now); const opening = minutes(seller.openingTime); const closing = minutes(seller.closingTime); return opening <= closing ? current >= opening && current <= closing : current >= opening || current <= closing; });
  const stores = new Map<number, any>();
  for (const { product, seller } of openRows) {
    const current = stores.get(seller.id) ?? { id: seller.id, shopName: seller.shopName, ownerName: seller.ownerName, whatsapp: seller.whatsapp, village: seller.village, district: seller.district, address: seller.address, avatarUrl: seller.avatarUrl, currentLocation: seller.currentLocation, openingTime: seller.openingTime, closingTime: seller.closingTime, freeShipping: Boolean(seller.freeShipping), productCount: 0, previewProducts: [] };
    current.productCount += 1;
    if (current.previewProducts.length < 3) current.previewProducts.push({ id: product.id, name: product.name, imageUrl: product.imageUrl, price: product.price });
    stores.set(seller.id, current);
  }
  return Array.from(stores.values());
}

export async function getPublicStoreDetail(sellerId: number) {
  const db = await getDb(); if (!db) return null;
  const sellers = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, sellerId)).limit(1);
  const seller = sellers[0];
  if (!seller || seller.verificationStatus !== "verified" || seller.isBanned) return null;
  const productRows = await db.select().from(products).where(and(eq(products.sellerId, sellerId), eq(products.status, "approved"))).orderBy(desc(products.createdAt));
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
  const current = minutes(now); const opening = minutes(seller.openingTime); const closing = minutes(seller.closingTime);
  const withinSchedule = opening <= closing ? current >= opening && current <= closing : current >= opening || current <= closing;
  return {
    store: { id: seller.id, shopName: seller.shopName, ownerName: seller.ownerName, whatsapp: seller.whatsapp, village: seller.village, district: seller.district, address: seller.address, currentLocation: seller.currentLocation, avatarUrl: seller.avatarUrl, openingTime: seller.openingTime, closingTime: seller.closingTime, isOpen: Boolean(seller.isOpen), withinSchedule, freeShipping: Boolean(seller.freeShipping), productCount: productRows.length },
    products: productRows.map((product) => ({ ...product, sellerFreeShipping: Boolean(seller.freeShipping), sellerLocation: seller.currentLocation, sellerVillage: seller.village, sellerDistrict: seller.district, openingTime: seller.openingTime, closingTime: seller.closingTime, storeOpen: Boolean(seller.isOpen && withinSchedule) })),
  };
}

export async function listSellerProducts(whatsapp: string) {
  const db = await getDb(); if (!db) return [];
  const sellers = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1);
  if (!sellers[0]) return [];
  return db.select().from(products).where(eq(products.sellerId, sellers[0].id)).orderBy(desc(products.createdAt));
}

export async function listSellerOrders(whatsapp: string) {
  const db = await getDb(); if (!db) return [];
  const sellers = await db.select().from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1);
  if (!sellers[0]) return [];
  const rows = await db.select({ order: orders, item: orderItems, productName: products.name, productPrice: products.price })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(products.sellerId, sellers[0].id))
    .orderBy(desc(orders.createdAt));
  const grouped = new Map<number, { order: typeof rows[number]["order"]; items: { name: string; price: number; quantity: number }[] }>();
  for (const row of rows) {
    const current = grouped.get(row.order.id) ?? { order: row.order, items: [] };
    current.items.push({ name: row.productName, price: row.productPrice, quantity: row.item.quantity });
    grouped.set(row.order.id, current);
  }
  return Array.from(grouped.values()).map(({ order, items }) => ({ ...order, items, sellerName: sellers[0].shopName }));
}

export async function getShippingSettings() {
  const db = await getDb();
  if (!db) return { ratePerKm: 3000, discountPercent: 0, handlingFeePercent: 0, originLatitude: "-7.602345", originLongitude: "111.904321", adminWhatsapp: "6281456015901", supportOpeningTime: "08:00", supportClosingTime: "20:00" };
  const rows = await db.select().from(shippingSettings).where(eq(shippingSettings.id, 1)).limit(1);
  const settings = rows[0];
  return settings ? { ratePerKm: settings.ratePerKm, discountPercent: settings.discountPercent, handlingFeePercent: settings.handlingFeePercent, originLatitude: settings.originLatitude, originLongitude: settings.originLongitude, adminWhatsapp: settings.adminWhatsapp, supportOpeningTime: settings.supportOpeningTime, supportClosingTime: settings.supportClosingTime } : { ratePerKm: 3000, discountPercent: 0, originLatitude: "-7.602345", originLongitude: "111.904321", adminWhatsapp: "6281456015901", handlingFeePercent: 0, supportOpeningTime: "08:00", supportClosingTime: "20:00" };
}

export async function saveShippingSettings(input: { ratePerKm: number; discountPercent: number; handlingFeePercent: number; originLatitude: string; originLongitude: string; adminWhatsapp: string; supportOpeningTime: string; supportClosingTime: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia.");
  await db.insert(shippingSettings).values({ id: 1, ...input }).onConflictDoUpdate({ target: shippingSettings.id, set: { ...input, updatedAt: new Date() } });
  return getShippingSettings();
}

const DEFAULT_PROMO_SLOTS = JSON.stringify([{ id: "promo-1", title: "Promo warga Sawahan", description: "Temukan penawaran terbaru dari toko lokal.", cta: "Jelajahi sekarang", color: "orange", active: true, startsAt: null, endsAt: null, bannerImageUrl: null }]);
const DEFAULT_SITE_SETTINGS = { id: 1, brandName: "PASARKU", tagline: "Belanja dekat, berdampak hebat.", heroTitle: "Belanja dekat,", heroHighlight: "berdampak hebat.", heroDescription: "Temukan produk dan jasa dari tetangga sendiri.", heroBackgroundUrl: null as string | null, heroBackgroundColor: "#d45b39", heroOverlayColor: "#7a2f2f", heroOverlayOpacity: 28, heroBackgroundPosition: "center", promoTitle: "Promo warga Sawahan", promoDescription: "Temukan penawaran terbaru dari toko lokal.", promoCta: "Jelajahi sekarang", promoActive: 1, promoColor: "orange", logoUrl: null as string | null, bannerImageUrl: null as string | null, promoStartsAt: null as Date | null, promoEndsAt: null as Date | null, promoSlots: DEFAULT_PROMO_SLOTS };

export async function getSiteSettings() {
  const db = await getDb(); if (!db) return DEFAULT_SITE_SETTINGS;
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  return rows[0] ?? DEFAULT_SITE_SETTINGS;
}

export async function saveSiteSettings(input: Partial<Omit<typeof DEFAULT_SITE_SETTINGS, "id">> & Pick<typeof DEFAULT_SITE_SETTINGS, "brandName" | "tagline" | "heroTitle" | "heroHighlight" | "heroDescription" | "promoTitle" | "promoDescription" | "promoCta" | "promoActive" | "promoColor">) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const current = await getSiteSettings();
  const { id: _id, ...values } = { ...current, ...input };
  await db.insert(siteSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: siteSettings.id, set: { ...values, updatedAt: new Date() } });
  return getSiteSettings();
}

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string };

export async function savePushSubscription(input: PushSubscriptionInput) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  await db.insert(pushSubscriptions).values({ endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent ?? null }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent ?? null, updatedAt: new Date() } });
  return { success: true } as const;
}

export async function removePushSubscription(endpoint: string) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return { success: true } as const;
}

export async function listPushSubscriptions() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(pushSubscriptions);
}

export async function deletePushSubscription(endpoint: string) {
  const db = await getDb(); if (!db) return;
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function hasPromoDeliveryBeenSent(slotId: string, endpoint: string) {
  const db = await getDb(); if (!db) return false;
  const rows = await db.select({ id: promoNotificationDeliveries.id }).from(promoNotificationDeliveries).where(and(eq(promoNotificationDeliveries.slotId, slotId), eq(promoNotificationDeliveries.endpoint, endpoint))).limit(1);
  return Boolean(rows[0]);
}

export async function markPromoDeliverySent(slotId: string, endpoint: string) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  try { await db.insert(promoNotificationDeliveries).values({ slotId, endpoint }); } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (!message.includes("duplicate") && !message.includes("unique")) throw error;
  }
}

export async function hasPromoNotificationBeenSent(slotId: string) {
  const db = await getDb(); if (!db) return false;
  const rows = await db.select({ id: promoNotificationLogs.id }).from(promoNotificationLogs).where(eq(promoNotificationLogs.slotId, slotId)).limit(1);
  return Boolean(rows[0]);
}

export async function markPromoNotificationSent(slotId: string) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  await db.insert(promoNotificationLogs).values({ slotId }).onConflictDoUpdate({ target: promoNotificationLogs.slotId, set: { sentAt: new Date() } });
}

export async function createSupportTicket(input: { ticketCode: string; customerName: string; whatsapp: string; context: string; message: string }) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  await db.insert(supportTickets).values({ ...input, status: "open" });
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.ticketCode, input.ticketCode)).limit(1);
  return rows[0];
}

export async function listSupportTickets() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(100);
}

export async function updateSupportTicketStatus(id: number, status: "open" | "in_progress" | "resolved") {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  await db.update(supportTickets).set({ status, updatedAt: new Date() }).where(eq(supportTickets.id, id));
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteSupportTicket(id: number, admin: { name: string; whatsapp: string }) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  const ticket = rows[0];
  if (!ticket) throw new Error("Tiket bantuan tidak ditemukan.");
  await db.transaction(async (tx) => {
    await tx.delete(supportTickets).where(eq(supportTickets.id, id));
    await tx.insert(adminAuditLogs).values({ adminName: admin.name, adminWhatsapp: admin.whatsapp, action: "delete_support_ticket", targetRole: "support", targetId: id, targetName: ticket.ticketCode, details: `Tiket bantuan ${ticket.ticketCode} dihapus oleh Admin.` });
  });
  return { success: true as const, id };
}

const referralCodeForId = (id: number) => `PK${id.toString(36).toUpperCase().padStart(5, "0")}`;

export async function getBuyerProfile(whatsapp: string) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(buyerProfiles).where(eq(buyerProfiles.whatsapp, whatsapp)).limit(1);
  const profile = rows[0];
  if (!profile) return null;
  let referralCode = profile.referralCode;
  if (!referralCode) {
    referralCode = referralCodeForId(profile.id);
    await db.update(buyerProfiles).set({ referralCode, updatedAt: new Date() }).where(eq(buyerProfiles.id, profile.id));
  }
  const referredRows = await db.select({ id: buyerProfiles.id }).from(buyerProfiles).where(eq(buyerProfiles.referredByCode, referralCode));
  return { ...profile, referralCode, referralCount: referredRows.length };
}

export async function findBuyerByReferralCode(code: string) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select({ id: buyerProfiles.id, whatsapp: buyerProfiles.whatsapp, referralCode: buyerProfiles.referralCode }).from(buyerProfiles).where(eq(buyerProfiles.referralCode, code.trim().toUpperCase())).limit(1);
  return rows[0] ?? null;
}

export async function listBuyerProfiles() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(buyerProfiles).orderBy(desc(buyerProfiles.updatedAt));
}

export const PERMANENT_ADMIN_WHATSAPP = "6282330503206";
export const isPermanentAdminWhatsapp = (whatsapp: string) => {
  const digits = whatsapp.replace(/\D/g, "");
  return digits === "082330503206" || digits === PERMANENT_ADMIN_WHATSAPP;
};

export async function getAdminProfile(whatsapp: string) {
  const db = await getDb(); if (!db) return null;
  const rows = await db.select().from(adminProfiles).where(eq(adminProfiles.whatsapp, whatsapp)).limit(1);
  return rows[0] ?? null;
}

export async function listAdminProfiles() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(adminProfiles).orderBy(desc(adminProfiles.createdAt));
}
export async function updateAdminProfile(id: number, name: string, whatsapp: string) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const cleanName = name.trim();
  await db.transaction(async (tx) => {
    const currentRows = await tx.select().from(adminProfiles).where(eq(adminProfiles.id, id)).limit(1);
    if (!currentRows[0]) throw new Error("Admin tidak ditemukan.");
    if (isPermanentAdminWhatsapp(currentRows[0].whatsapp) || isPermanentAdminWhatsapp(whatsapp)) throw new Error("Admin permanen hanya dapat diubah melalui kode program.");
    const conflict = await tx.select().from(adminProfiles).where(eq(adminProfiles.whatsapp, whatsapp)).limit(1);
    if (conflict[0] && conflict[0].id !== id) throw new Error("Nomor WhatsApp sudah terdaftar sebagai admin lain.");
    const oldWhatsapp = currentRows[0].whatsapp;
    await tx.update(adminProfiles).set({ name: cleanName, whatsapp, updatedAt: new Date() }).where(eq(adminProfiles.id, id));
    if (oldWhatsapp !== whatsapp) {
      const oldAccount = await tx.select().from(userAccounts).where(eq(userAccounts.whatsapp, oldWhatsapp)).limit(1);
      if (oldAccount[0]) {
        await tx.update(userAccounts).set({ isAdmin: 0, updatedAt: new Date() }).where(eq(userAccounts.whatsapp, oldWhatsapp));
        if (!oldAccount[0].isBuyer && !oldAccount[0].isSeller && !oldAccount[0].isCourier) await tx.delete(userAccounts).where(eq(userAccounts.whatsapp, oldWhatsapp));
      }
    }
    await tx.insert(userAccounts).values({ whatsapp, displayName: cleanName, isAdmin: 1 }).onConflictDoUpdate({ target: userAccounts.whatsapp, set: { displayName: cleanName, isAdmin: 1, updatedAt: new Date() } });
  });
  return getAdminProfile(whatsapp);
}

export async function deleteAdminProfile(id: number, admin: { name: string; whatsapp: string }) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  await db.transaction(async (tx) => {
    const allAdmins = await tx.select().from(adminProfiles);
    if (allAdmins.length <= 1) throw new Error("Admin terakhir tidak dapat dihapus.");
    const targetRows = await tx.select().from(adminProfiles).where(eq(adminProfiles.id, id)).limit(1);
    const target = targetRows[0];
    if (!target) throw new Error("Admin tidak ditemukan.");
    if (isPermanentAdminWhatsapp(target.whatsapp)) throw new Error("Admin permanen hanya dapat dihapus melalui kode program.");
    if (target.whatsapp === admin.whatsapp) throw new Error("Admin yang sedang digunakan tidak dapat menghapus dirinya sendiri.");
    await tx.delete(adminProfiles).where(eq(adminProfiles.id, id));
    const accountRows = await tx.select().from(userAccounts).where(eq(userAccounts.whatsapp, target.whatsapp)).limit(1);
    if (accountRows[0]) {
      await tx.update(userAccounts).set({ isAdmin: 0, updatedAt: new Date() }).where(eq(userAccounts.whatsapp, target.whatsapp));
      if (!accountRows[0].isBuyer && !accountRows[0].isSeller && !accountRows[0].isCourier) await tx.delete(userAccounts).where(eq(userAccounts.whatsapp, target.whatsapp));
    }
    await tx.insert(adminAuditLogs).values({ adminName: admin.name, adminWhatsapp: admin.whatsapp, action: "delete_admin", targetRole: "admin", targetId: id, targetName: target.name, details: `Admin ${target.name} dan akses OTP nomor +${target.whatsapp} dihapus.` });
  });
  return { success: true as const, id };
}
export async function upsertAccountRole(whatsapp: string, role: "buyer" | "seller" | "courier" | "admin", displayName: string) {
  const db = await getDb(); if (!db) return null;
  const roleField = { buyer: "isBuyer", seller: "isSeller", courier: "isCourier", admin: "isAdmin" }[role];
  await db.insert(userAccounts).values({ whatsapp, displayName, [roleField]: 1 }).onConflictDoUpdate({ target: userAccounts.whatsapp, set: { displayName, [roleField]: 1, updatedAt: new Date() } });
  const rows = await db.select().from(userAccounts).where(eq(userAccounts.whatsapp, whatsapp)).limit(1);
  return rows[0] ?? null;
}

export async function getAccountRoles(whatsapp: string) {
  const db = await getDb(); if (!db) return null;
  let rows = await db.select().from(userAccounts).where(eq(userAccounts.whatsapp, whatsapp)).limit(1);
  const [buyer, seller, courier, admin] = await Promise.all([
    db.select({ name: buyerProfiles.name }).from(buyerProfiles).where(eq(buyerProfiles.whatsapp, whatsapp)).limit(1),
    db.select({ name: sellerProfiles.ownerName }).from(sellerProfiles).where(eq(sellerProfiles.whatsapp, whatsapp)).limit(1),
    db.select({ name: courierProfiles.name }).from(courierProfiles).where(eq(courierProfiles.whatsapp, whatsapp)).limit(1),
    db.select({ name: adminProfiles.name }).from(adminProfiles).where(eq(adminProfiles.whatsapp, whatsapp)).limit(1),
  ]);
  const discovered = buyer[0] ? ["buyer", buyer[0].name] : seller[0] ? ["seller", seller[0].name] : courier[0] ? ["courier", courier[0].name] : admin[0] ? ["admin", admin[0].name] : null;
  if (!rows[0] && discovered) await upsertAccountRole(whatsapp, discovered[0] as any, discovered[1]);
  for (const [role, name] of [["buyer", buyer[0]?.name], ["seller", seller[0]?.name], ["courier", courier[0]?.name], ["admin", admin[0]?.name]] as const) {
    if (name && (!rows[0] || !rows[0][({ buyer: "isBuyer", seller: "isSeller", courier: "isCourier", admin: "isAdmin" } as const)[role]])) await upsertAccountRole(whatsapp, role, name);
  }
  if (!rows[0] || discovered) rows = await db.select().from(userAccounts).where(eq(userAccounts.whatsapp, whatsapp)).limit(1);
  return rows[0] ?? null;
}

export async function listOrders() {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  return Promise.all(rows.map(async (order) => ({ ...order, items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)) })));
}

export type TaxCashEntryInput = {
  entryDate: string;
  voucherNo: string;
  category: string;
  description: string;
  income: number;
  expense: number;
  pphStatus: string;
  paymentStatus: string;
  billingCode?: string | null;
  merchantName?: string | null;
};

export async function listTaxCashEntries(year?: number) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select().from(taxCashEntries).orderBy(desc(taxCashEntries.entryDate), desc(taxCashEntries.id));
  return year ? rows.filter((entry) => entry.entryDate.startsWith(`${year}-`)) : rows;
}

export async function syncCompletedOrderTaxEntries() {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const completed = await db.select({ id: orders.id, orderCode: orders.orderCode, subtotal: orders.subtotal, handlingFee: orders.handlingFee, createdAt: orders.createdAt }).from(orders).where(eq(orders.status, "Selesai"));
  let created = 0;
  for (const order of completed) {
    const sourceId = String(order.id);
    const existing = await db.select({ id: taxCashEntries.id }).from(taxCashEntries).where(and(eq(taxCashEntries.sourceType, "order"), eq(taxCashEntries.sourceId, sourceId))).limit(1);
    if (existing[0]) continue;
    const income = Math.max(0, order.handlingFee || 0);
    await db.insert(taxCashEntries).values({ entryDate: new Date(order.createdAt).toISOString().slice(0, 10), voucherNo: order.orderCode, category: "Pendapatan Komisi", description: `Komisi PASARKU dari pesanan ${order.orderCode} (subtotal Rp${order.subtotal.toLocaleString("id-ID")})`, income, expense: 0, pphStatus: income > 0 ? "Objek PPh 0.5%" : "Bukan Omzet", paymentStatus: income > 0 ? "Sudah Diterima" : "Nihil", sourceType: "order", sourceId });
    created += 1;
  }
  const promoCreated = await syncPromoAdEntries(db);
  return { created: created + promoCreated, checked: completed.length, promoCreated };
}

async function syncPromoAdEntries(db: any) {
  const settings = await getSiteSettings();
  if (!settings?.promoSlots) return 0;
  let slots: Array<{ id?: string; title?: string; adFee?: number; adPaymentStatus?: string; adBillingCode?: string; adMerchantName?: string; startsAt?: string }> = [];
  try { slots = JSON.parse(settings.promoSlots); } catch { return 0; }
  let created = 0;
  for (const slot of slots) {
    const fee = Number(slot.adFee || 0);
    if (!slot.id || fee <= 0) continue;
    const sourceId = String(slot.id);
    const existing = await db.select({ id: taxCashEntries.id }).from(taxCashEntries).where(and(eq(taxCashEntries.sourceType, "promo"), eq(taxCashEntries.sourceId, sourceId))).limit(1);
    if (existing[0]) continue;
    await db.insert(taxCashEntries).values({ entryDate: slot.startsAt ? new Date(slot.startsAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10), voucherNo: `IKL-${sourceId}`, category: "Pendapatan Iklan/Banner", description: `Pendapatan banner promo: ${slot.title || sourceId}`, income: fee, expense: 0, pphStatus: "Objek PPh 0.5%", paymentStatus: slot.adPaymentStatus || "Belum Dibayar", billingCode: slot.adBillingCode || null, merchantName: slot.adMerchantName || null, sourceType: "promo", sourceId });
    created += 1;
  }
  return created;
}

export async function createTaxCashEntry(input: TaxCashEntryInput) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const values = { ...input, voucherNo: input.voucherNo.trim(), category: input.category.trim(), description: input.description.trim(), merchantName: input.merchantName?.trim() || null, billingCode: input.billingCode?.trim() || null, sourceType: "manual" as const, sourceId: null };
  await db.insert(taxCashEntries).values(values);
  const rows = await db.select().from(taxCashEntries).where(eq(taxCashEntries.voucherNo, values.voucherNo)).orderBy(desc(taxCashEntries.id)).limit(1);
  return rows[0] ?? null;
}

export async function updateTaxCashEntry(id: number, input: TaxCashEntryInput) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const current = await db.select().from(taxCashEntries).where(eq(taxCashEntries.id, id)).limit(1);
  if (!current[0]) throw new Error("Catatan Buku Kas tidak ditemukan.");
  if (current[0].sourceType !== "manual") throw new Error("Catatan otomatis dari pesanan tidak dapat diedit di sini.");
  await db.update(taxCashEntries).set({ ...input, voucherNo: input.voucherNo.trim(), category: input.category.trim(), description: input.description.trim(), merchantName: input.merchantName?.trim() || null, billingCode: input.billingCode?.trim() || null, updatedAt: new Date() }).where(eq(taxCashEntries.id, id));
  const rows = await db.select().from(taxCashEntries).where(eq(taxCashEntries.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteTaxCashEntry(id: number) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const current = await db.select().from(taxCashEntries).where(eq(taxCashEntries.id, id)).limit(1);
  if (!current[0]) throw new Error("Catatan Buku Kas tidak ditemukan.");
  if (current[0].sourceType !== "manual") throw new Error("Catatan otomatis dari pesanan tidak dapat dihapus di sini.");
  await db.delete(taxCashEntries).where(eq(taxCashEntries.id, id));
  return { success: true as const, id };
}

export async function deleteOrder(orderCode: string, admin: { name: string; whatsapp: string }) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const rows = await db.select().from(orders).where(eq(orders.orderCode, orderCode)).limit(1);
  const order = rows[0];
  if (!order) throw new Error("Catatan transaksi tidak ditemukan.");
  await db.transaction(async (tx) => {
    await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
    await tx.delete(orders).where(eq(orders.id, order.id));
    await tx.insert(adminAuditLogs).values({ adminName: admin.name, adminWhatsapp: admin.whatsapp, action: "delete_order", targetRole: "order", targetId: order.id, targetName: order.orderCode, details: `Catatan transaksi ${order.orderCode} dihapus oleh Admin.` });
  });
  return { success: true as const, orderCode };
}

export async function getOrderWithItems(orderCode: string) {
  const db = await getDb(); if (!db) return undefined;
  const found = await db.select().from(orders).where(eq(orders.orderCode, orderCode)).limit(1);
  if (!found[0]) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, found[0].id));
  return { ...found[0], items };
}
export async function listBuyerOrders(whatsapp: string) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select().from(orders).where(eq(orders.whatsapp, whatsapp)).orderBy(desc(orders.createdAt));
  return Promise.all(rows.map(async (order) => ({ ...order, items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)) })));
}

export async function listCourierOrders(courierId: number) {
  const db = await getDb(); if (!db) return [];
  const assignedOrders = await db.select().from(orders).where(eq(orders.courierId, courierId)).orderBy(desc(orders.createdAt));
  return Promise.all(assignedOrders.map(async (order) => {
    const sellerRows = await db.select({ shopName: sellerProfiles.shopName, village: sellerProfiles.village, currentLocation: sellerProfiles.currentLocation })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(sellerProfiles, eq(products.sellerId, sellerProfiles.id))
      .where(eq(orderItems.orderId, order.id))
      .limit(1);
    const seller = sellerRows[0];
    return {
      ...order,
      pickupShopName: seller?.shopName ?? "Penjual PASARKU",
      pickupVillage: seller?.village ?? "Sawahan",
      pickupLocation: seller?.currentLocation ?? order.pickupLocation,
      courierCurrentLocation: (await db.select({ currentLocation: courierProfiles.currentLocation }).from(courierProfiles).where(eq(courierProfiles.id, courierId)).limit(1))[0]?.currentLocation ?? null,
      courierLocationUpdatedAt: (await db.select({ updatedAt: courierProfiles.updatedAt }).from(courierProfiles).where(eq(courierProfiles.id, courierId)).limit(1))[0]?.updatedAt ?? null,
      items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    };
  }));
}

type AdminCourierTask = { orderCode: string; action: "pick up" | "mengantar"; status: string; customerName: string; address: string; village: string; pickupLocation: string | null };

export async function listCouriers() {
  const db = await getDb(); if (!db) return [];
  const couriers = await db.select({ id: courierProfiles.id, name: courierProfiles.name, whatsapp: courierProfiles.whatsapp, vehicle: courierProfiles.vehicle, currentLocation: courierProfiles.currentLocation, updatedAt: courierProfiles.updatedAt, verificationStatus: courierProfiles.verificationStatus, isBanned: courierProfiles.isBanned }).from(courierProfiles).where(and(eq(courierProfiles.verificationStatus, "verified"), eq(courierProfiles.isBanned, 0))).orderBy(courierProfiles.name);
  if (!couriers.length) return couriers.map((courier) => ({ ...courier, activeTasks: [] as AdminCourierTask[] }));
  const activeOrders = await db.select({ id: orders.id, orderCode: orders.orderCode, courierId: orders.courierId, status: orders.status, customerName: orders.customerName, address: orders.address, village: orders.village, pickupLocation: orders.pickupLocation })
    .from(orders)
    .where(and(inArray(orders.courierId, couriers.map((courier) => courier.id)), sql`${orders.status} NOT IN ('Selesai', 'Dibatalkan')`));
  const tasksByCourier = new Map<number, AdminCourierTask[]>();
  for (const order of activeOrders) {
    if (!order.courierId) continue;
    const tasks = tasksByCourier.get(order.courierId) ?? [];
    tasks.push({ orderCode: order.orderCode, action: order.status === "Diantar" ? "mengantar" : "pick up", status: order.status, customerName: order.customerName, address: order.address, village: order.village, pickupLocation: order.pickupLocation });
    tasksByCourier.set(order.courierId, tasks);
  }
  return couriers.map((courier) => ({ ...courier, activeTasks: tasksByCourier.get(courier.id) ?? [] }));
}

export async function listSellerCouriers() {
  return listCouriers();
}

export async function getAdminUserDirectory() {
  const db = await getDb();
  if (!db) return { buyers: [], sellers: [], couriers: [], pendingBuyers: [], pendingSellers: [], pendingCouriers: [] };
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
    buyers: await Promise.all(buyers.map(async (buyer) => { const referralCode = buyer.referralCode || referralCodeForId(buyer.id); if (!buyer.referralCode) await db.update(buyerProfiles).set({ referralCode }).where(eq(buyerProfiles.id, buyer.id)); const referralCount = (await db.select({ id: buyerProfiles.id }).from(buyerProfiles).where(eq(buyerProfiles.referredByCode, referralCode))).length; return { ...buyer, referralCode, referralCount, orderCount: orderCounts.get(buyer.whatsapp)?.count ?? 0, lastOrderCode: orderCounts.get(buyer.whatsapp)?.lastOrderCode ?? null }; })),
    sellers: sellers.map((seller) => ({ ...seller, productCount: productCounts.get(seller.id) ?? 0 })),
    couriers,
    pendingBuyers: buyers.filter((buyer) => buyer.verificationStatus === "pending" || buyer.verificationStatus === "unverified"),
    pendingSellers: sellers.filter((seller) => seller.verificationStatus === "pending" || seller.verificationStatus === "unverified"),
    pendingCouriers: couriers.filter((courier) => courier.verificationStatus === "pending" || courier.verificationStatus === "unverified"),
  };
}

export async function listAdminAuditLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(50);
}

export async function deleteAdminAuditLogs(ids: number[], adminWhatsapp: string) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia.");
  if (!isPermanentAdminWhatsapp(adminWhatsapp)) throw new Error("Hanya admin permanen yang dapat menghapus riwayat aktivitas Admin.");
  const cleanIds = Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id > 0).slice(0, 50);
  if (!cleanIds.length) return { success: true as const, deleted: 0 };
  await db.delete(adminAuditLogs).where(inArray(adminAuditLogs.id, cleanIds));
  return { success: true as const, deleted: cleanIds.length };
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

export async function deleteMarketplaceUser(role: "buyer" | "seller" | "courier", id: number, admin: { name: string; whatsapp: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia.");
  const roleField = { buyer: "isBuyer", seller: "isSeller", courier: "isCourier" }[role] as "isBuyer" | "isSeller" | "isCourier";
  let whatsapp: string | null = null;
  let targetName = "";
  await db.transaction(async (tx) => {
    if (role === "buyer") {
      const rows = await tx.select({ whatsapp: buyerProfiles.whatsapp, name: buyerProfiles.name }).from(buyerProfiles).where(eq(buyerProfiles.id, id)).limit(1);
      if (!rows[0]) throw new Error("Data pembeli tidak ditemukan.");
      whatsapp = rows[0].whatsapp;
      targetName = rows[0].name;
      await tx.delete(buyerProfiles).where(eq(buyerProfiles.id, id));
    } else if (role === "seller") {
      const rows = await tx.select({ whatsapp: sellerProfiles.whatsapp, shopName: sellerProfiles.shopName }).from(sellerProfiles).where(eq(sellerProfiles.id, id)).limit(1);
      if (!rows[0]) throw new Error("Data toko tidak ditemukan.");
      whatsapp = rows[0].whatsapp;
      targetName = rows[0].shopName;
      const sellerProducts = await tx.select({ id: products.id }).from(products).where(eq(products.sellerId, id));
      const productIds = sellerProducts.map((item) => item.id);
      if (productIds.length) {
        await tx.update(orderItems).set({ productId: null }).where(inArray(orderItems.productId, productIds));
        await tx.delete(products).where(inArray(products.id, productIds));
      }
      await tx.delete(sellerProfiles).where(eq(sellerProfiles.id, id));
    } else {
      const rows = await tx.select({ whatsapp: courierProfiles.whatsapp, name: courierProfiles.name }).from(courierProfiles).where(eq(courierProfiles.id, id)).limit(1);
      if (!rows[0]) throw new Error("Data kurir tidak ditemukan.");
      whatsapp = rows[0].whatsapp;
      targetName = rows[0].name;
      await tx.update(orders).set({ courierId: null }).where(eq(orders.courierId, id));
      await tx.delete(courierProfiles).where(eq(courierProfiles.id, id));
    }
    if (whatsapp) {
      const accountRows = await tx.select().from(userAccounts).where(eq(userAccounts.whatsapp, whatsapp)).limit(1);
      const account = accountRows[0];
      if (account) {
        await tx.update(userAccounts).set({ [roleField]: 0, updatedAt: new Date() }).where(eq(userAccounts.whatsapp, whatsapp));
        const remaining = await tx.select().from(userAccounts).where(eq(userAccounts.whatsapp, whatsapp)).limit(1);
        const next = remaining[0];
        if (next && !next.isBuyer && !next.isSeller && !next.isCourier && !next.isAdmin) await tx.delete(userAccounts).where(eq(userAccounts.whatsapp, whatsapp));
      }
    }
    await tx.insert(adminAuditLogs).values({ adminName: admin.name, adminWhatsapp: admin.whatsapp, action: "delete_user", targetRole: role, targetId: id, targetName, details: role === "seller" ? "Profil toko dan produk dihapus; histori pesanan dipertahankan." : "Profil dihapus; histori pesanan dipertahankan." });
  });
  return { success: true as const, role, id };
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { activeOrders: 0, registeredStores: 0, readyCouriers: 0, revenue: 0, visitorTotal: 0, visitorToday: 0 };
  const [orderRows, storeRows, courierRows, visitorRows] = await Promise.all([
    db.select({ status: orders.status, total: orders.total }).from(orders),
    db.select({ id: sellerProfiles.id, verificationStatus: sellerProfiles.verificationStatus, isBanned: sellerProfiles.isBanned }).from(sellerProfiles),
    db.select({ id: courierProfiles.id, verificationStatus: courierProfiles.verificationStatus, isBanned: courierProfiles.isBanned }).from(courierProfiles),
    db.select().from(visitorStats).where(eq(visitorStats.id, 1)).limit(1),
  ]);
  const visitors = visitorRows[0];
  return {
    activeOrders: orderRows.filter((order) => order.status !== "Selesai" && order.status !== "Dibatalkan").length,
    registeredStores: storeRows.filter((store) => store.verificationStatus === "verified" && !store.isBanned).length,
    readyCouriers: courierRows.filter((courier) => courier.verificationStatus === "verified" && !courier.isBanned).length,
    revenue: orderRows.reduce((sum, order) => sum + order.total, 0),
    visitorTotal: visitors?.totalVisits ?? 0,
    visitorToday: visitors?.todayVisits ?? 0,
  };
}

const jakartaDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

export async function recordVisitorVisit() {
  const db = await getDb();
  if (!db) return { totalVisits: 0, todayVisits: 0 };
  const today = jakartaDate();
  await db.insert(visitorStats).values({ id: 1, totalVisits: 1, todayVisits: 1, lastVisitDate: today }).onConflictDoUpdate({
    target: visitorStats.id,
    set: {
      totalVisits: sql`${visitorStats.totalVisits} + 1`,
      todayVisits: sql`CASE WHEN ${visitorStats.lastVisitDate} = ${today} THEN ${visitorStats.todayVisits} + 1 ELSE 1 END`,
      lastVisitDate: today,
      updatedAt: new Date(),
    },
  });
  const rows = await db.select({ totalVisits: visitorStats.totalVisits, todayVisits: visitorStats.todayVisits }).from(visitorStats).where(eq(visitorStats.id, 1)).limit(1);
  return rows[0] ?? { totalVisits: 0, todayVisits: 0 };
}

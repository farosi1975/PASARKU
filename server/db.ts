import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { ENV } from "./_core/env";
import { InsertUser, adminProfiles, buyerProfiles, courierProfiles, orderItems, orders, products, sellerProfiles, shippingSettings, siteSettings, supportTickets, userAccounts, users, visitorStats } from "../drizzle/schema";

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined }); _db = drizzle(_pool); } catch (error) { console.warn("[Database] Failed to connect:", error); _pool = null; _db = null; }
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
  return rows.filter(({ seller }) => { const current = minutes(now); const opening = minutes(seller.openingTime); const closing = minutes(seller.closingTime); return opening <= closing ? current >= opening && current <= closing : current >= opening || current <= closing; }).map(({ product, seller }) => ({ ...product, sellerFreeShipping: Boolean(seller.freeShipping), sellerLocation: seller.currentLocation, sellerVillage: seller.village, openingTime: seller.openingTime, closingTime: seller.closingTime }));
}

export async function listOpenStores() {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({ product: products, seller: sellerProfiles }).from(products).innerJoin(sellerProfiles, eq(products.sellerId, sellerProfiles.id)).where(and(eq(products.status, "approved"), eq(sellerProfiles.verificationStatus, "verified"), eq(sellerProfiles.isBanned, 0), eq(sellerProfiles.isOpen, 1))).orderBy(desc(products.createdAt));
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
  const openRows = rows.filter(({ seller }) => { const current = minutes(now); const opening = minutes(seller.openingTime); const closing = minutes(seller.closingTime); return opening <= closing ? current >= opening && current <= closing : current >= opening || current <= closing; });
  const stores = new Map<number, any>();
  for (const { product, seller } of openRows) {
    const current = stores.get(seller.id) ?? { id: seller.id, shopName: seller.shopName, ownerName: seller.ownerName, whatsapp: seller.whatsapp, village: seller.village, address: seller.address, avatarUrl: seller.avatarUrl, currentLocation: seller.currentLocation, openingTime: seller.openingTime, closingTime: seller.closingTime, freeShipping: Boolean(seller.freeShipping), productCount: 0, previewProducts: [] };
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
    store: { id: seller.id, shopName: seller.shopName, ownerName: seller.ownerName, whatsapp: seller.whatsapp, village: seller.village, address: seller.address, currentLocation: seller.currentLocation, avatarUrl: seller.avatarUrl, openingTime: seller.openingTime, closingTime: seller.closingTime, isOpen: Boolean(seller.isOpen), withinSchedule, freeShipping: Boolean(seller.freeShipping), productCount: productRows.length },
    products: productRows.map((product) => ({ ...product, sellerFreeShipping: Boolean(seller.freeShipping), sellerLocation: seller.currentLocation, sellerVillage: seller.village, openingTime: seller.openingTime, closingTime: seller.closingTime, storeOpen: Boolean(seller.isOpen && withinSchedule) })),
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

export async function createSupportTicket(input: { ticketCode: string; customerName: string; whatsapp: string; context: string; message: string }) {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const rows = await db.insert(supportTickets).values({ ...input, status: "open" }).returning();
  return rows[0];
}

export async function listSupportTickets() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt)).limit(100);
}

export async function updateSupportTicketStatus(id: number, status: "open" | "in_progress" | "resolved") {
  const db = await getDb(); if (!db) throw new Error("Database belum tersedia.");
  const rows = await db.update(supportTickets).set({ status, updatedAt: new Date() }).where(eq(supportTickets.id, id)).returning();
  return rows[0] ?? null;
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
  await db.insert(userAccounts).values({ whatsapp, displayName, [roleField]: 1 }).onConflictDoUpdate({ target: userAccounts.whatsapp, set: { displayName, [roleField]: 1, updatedAt: new Date() } });
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
    };
  }));
}

export async function listCouriers() {
  const db = await getDb(); if (!db) return [];
  return db.select({ id: courierProfiles.id, name: courierProfiles.name, whatsapp: courierProfiles.whatsapp, vehicle: courierProfiles.vehicle, verificationStatus: courierProfiles.verificationStatus, isBanned: courierProfiles.isBanned }).from(courierProfiles).where(and(eq(courierProfiles.verificationStatus, "verified"), eq(courierProfiles.isBanned, 0))).orderBy(courierProfiles.name);
}

export async function listSellerCouriers() {
  return listCouriers();
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
    couriers,
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

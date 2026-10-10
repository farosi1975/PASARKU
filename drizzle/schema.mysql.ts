import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sellerProfiles = mysqlTable("seller_profiles", {
  id: int("id").autoincrement().primaryKey(),
  shopName: varchar("shopName", { length: 160 }).notNull(),
  ownerName: varchar("ownerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  avatarUrl: text("avatarUrl"),
  identityPhotoUrl: text("identityPhotoUrl"),
  selfiePhotoUrl: text("selfiePhotoUrl"),
  identityPhotoKey: text("identityPhotoKey"),
  selfiePhotoKey: text("selfiePhotoKey"),
  village: varchar("village", { length: 80 }).notNull(),
  address: text("address"),
  currentLocation: text("currentLocation"),
  openingTime: varchar("openingTime", { length: 5 }).default("08:00").notNull(),
  closingTime: varchar("closingTime", { length: 5 }).default("20:00").notNull(),
  preferredCourierId: int("preferredCourierId"),
  isOpen: int("isOpen").default(1).notNull(),
  freeShipping: int("freeShipping").default(0).notNull(),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected", "unverified"]).default("pending").notNull(),
  documentsReviewedAt: timestamp("documentsReviewedAt"),
  isBanned: int("isBanned").default(0).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const courierProfiles = mysqlTable("courier_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  avatarUrl: text("avatarUrl"),
  identityPhotoUrl: text("identityPhotoUrl"),
  selfiePhotoUrl: text("selfiePhotoUrl"),
  identityPhotoKey: text("identityPhotoKey"),
  selfiePhotoKey: text("selfiePhotoKey"),
  vehicle: varchar("vehicle", { length: 40 }).notNull(),
  village: varchar("village", { length: 80 }).default("Sawahan").notNull(),
  address: text("address"),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "rejected", "unverified"]).default("pending").notNull(),
  documentsReviewedAt: timestamp("documentsReviewedAt"),
  isBanned: int("isBanned").default(0).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const buyerProfiles = mysqlTable("buyer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  avatarUrl: text("avatarUrl"),
  village: varchar("village", { length: 80 }).notNull(),
  address: text("address"),
  verificationStatus: mysqlEnum("verificationStatus", ["pending", "verified", "unverified"]).default("verified").notNull(),
  isBanned: int("isBanned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const shippingSettings = mysqlTable("shipping_settings", {
  id: int("id").autoincrement().primaryKey(),
  ratePerKm: int("ratePerKm").default(3000).notNull(),
  discountPercent: int("discountPercent").default(0).notNull(),
  handlingFeePercent: int("handlingFeePercent").default(0).notNull(),
  originLatitude: varchar("originLatitude", { length: 32 }).default("-7.602345").notNull(),
  originLongitude: varchar("originLongitude", { length: 32 }).default("111.904321").notNull(),
  adminWhatsapp: varchar("adminWhatsapp", { length: 32 }).default("6281456015901").notNull(),
  supportOpeningTime: varchar("supportOpeningTime", { length: 5 }).default("08:00").notNull(),
  supportClosingTime: varchar("supportClosingTime", { length: 5 }).default("20:00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const siteSettings = mysqlTable("site_settings", {
  id: int("id").autoincrement().primaryKey(),
  brandName: varchar("brandName", { length: 80 }).default("PASARKU").notNull(),
  tagline: varchar("tagline", { length: 180 }).default("Belanja dekat, berdampak hebat.").notNull(),
  heroTitle: varchar("heroTitle", { length: 180 }).default("Belanja dekat,").notNull(),
  heroHighlight: varchar("heroHighlight", { length: 180 }).default("berdampak hebat.").notNull(),
  heroDescription: text("heroDescription").default("Temukan produk dan jasa dari tetangga sendiri.").notNull(),
  heroBackgroundUrl: text("heroBackgroundUrl"),
  heroBackgroundColor: varchar("heroBackgroundColor", { length: 20 }).default("#d45b39").notNull(),
  heroOverlayColor: varchar("heroOverlayColor", { length: 20 }).default("#7a2f2f").notNull(),
  heroOverlayOpacity: int("heroOverlayOpacity").default(28).notNull(),
  heroBackgroundPosition: varchar("heroBackgroundPosition", { length: 20 }).default("center").notNull(),
  promoTitle: varchar("promoTitle", { length: 160 }).default("Promo warga Sawahan").notNull(),
  promoDescription: text("promoDescription").default("Temukan penawaran terbaru dari toko lokal.").notNull(),
  promoCta: varchar("promoCta", { length: 80 }).default("Jelajahi sekarang").notNull(),
  promoActive: int("promoActive").default(1).notNull(),
  promoColor: varchar("promoColor", { length: 20 }).default("orange").notNull(),
  logoUrl: text("logoUrl"),
  bannerImageUrl: text("bannerImageUrl"),
  promoStartsAt: timestamp("promoStartsAt"),
  promoEndsAt: timestamp("promoEndsAt"),
  promoSlots: text("promoSlots"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  ticketCode: varchar("ticketCode", { length: 32 }).notNull().unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
  context: varchar("context", { length: 180 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const visitorStats = mysqlTable("visitor_stats", {
  id: int("id").autoincrement().primaryKey(),
  totalVisits: int("totalVisits").default(0).notNull(),
  todayVisits: int("todayVisits").default(0).notNull(),
  lastVisitDate: varchar("lastVisitDate", { length: 10 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const adminProfiles = mysqlTable("admin_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  verifiedAt: timestamp("verifiedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const userAccounts = mysqlTable("user_accounts", {
  id: int("id").autoincrement().primaryKey(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  isBuyer: int("isBuyer").default(0).notNull(),
  isSeller: int("isSeller").default(0).notNull(),
  isCourier: int("isCourier").default(0).notNull(),
  isAdmin: int("isAdmin").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminName: varchar("adminName", { length: 160 }).notNull(),
  adminWhatsapp: varchar("adminWhatsapp", { length: 32 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  targetRole: varchar("targetRole", { length: 20 }).notNull(),
  targetId: int("targetId").notNull(),
  targetName: varchar("targetName", { length: 180 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId"),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  price: int("price").notNull(),
  stock: int("stock").default(0).notNull(),
  imageUrl: text("imageUrl"),
  vendor: varchar("vendor", { length: 160 }).notNull(),
  location: varchar("location", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["draft", "approved", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderCode: varchar("orderCode", { length: 32 }).notNull().unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
  village: varchar("village", { length: 80 }).notNull(),
  address: text("address").notNull(),
  currentLocation: text("currentLocation"),
  pickupLocation: text("pickupLocation"),
  routeDistanceKm: int("routeDistanceKm"),
  note: text("note"),
  subtotal: int("subtotal").notNull(),
  handlingFee: int("handlingFee").default(0).notNull(),
  delivery: int("delivery").notNull(),
  total: int("total").notNull(),
  payment: varchar("payment", { length: 30 }).notNull(),
  status: mysqlEnum("status", ["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]).default("Menunggu").notNull(),
  courierId: int("courierId"),
  courierAcceptedAt: timestamp("courierAcceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  productName: varchar("productName", { length: 180 }).notNull(),
  price: int("price").notNull(),
  quantity: int("quantity").notNull(),
});

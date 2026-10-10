import { integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pending", "verified", "rejected", "unverified"]);
export const buyerVerificationStatusEnum = pgEnum("buyer_verification_status", ["pending", "verified", "unverified"]);
export const productStatusEnum = pgEnum("product_status", ["draft", "approved", "archived"]);
export const orderStatusEnum = pgEnum("order_status", ["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sellerProfiles = pgTable("seller_profiles", {
  id: serial("id").primaryKey(),
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
  preferredCourierId: integer("preferredCourierId"),
  isOpen: integer("isOpen").default(1).notNull(),
  freeShipping: integer("freeShipping").default(0).notNull(),
  verificationStatus: verificationStatusEnum("verificationStatus").default("pending").notNull(),
  documentsReviewedAt: timestamp("documentsReviewedAt"),
  isBanned: integer("isBanned").default(0).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const courierProfiles = pgTable("courier_profiles", {
  id: serial("id").primaryKey(),
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
  verificationStatus: verificationStatusEnum("verificationStatus").default("pending").notNull(),
  documentsReviewedAt: timestamp("documentsReviewedAt"),
  isBanned: integer("isBanned").default(0).notNull(),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const buyerProfiles = pgTable("buyer_profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  avatarUrl: text("avatarUrl"),
  village: varchar("village", { length: 80 }).notNull(),
  address: text("address"),
  verificationStatus: buyerVerificationStatusEnum("verificationStatus").default("verified").notNull(),
  isBanned: integer("isBanned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const shippingSettings = pgTable("shipping_settings", {
  id: serial("id").primaryKey(),
  ratePerKm: integer("ratePerKm").default(3000).notNull(),
  discountPercent: integer("discountPercent").default(0).notNull(),
  handlingFeePercent: integer("handlingFeePercent").default(0).notNull(),
  originLatitude: varchar("originLatitude", { length: 32 }).default("-7.602345").notNull(),
  originLongitude: varchar("originLongitude", { length: 32 }).default("111.904321").notNull(),
  adminWhatsapp: varchar("adminWhatsapp", { length: 32 }).default("6281456015901").notNull(),
  supportOpeningTime: varchar("supportOpeningTime", { length: 5 }).default("08:00").notNull(),
  supportClosingTime: varchar("supportClosingTime", { length: 5 }).default("20:00").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  brandName: varchar("brandName", { length: 80 }).default("PASARKU").notNull(),
  tagline: varchar("tagline", { length: 180 }).default("Belanja dekat, berdampak hebat.").notNull(),
  heroTitle: varchar("heroTitle", { length: 180 }).default("Belanja dekat,").notNull(),
  heroHighlight: varchar("heroHighlight", { length: 180 }).default("berdampak hebat.").notNull(),
  heroDescription: text("heroDescription").default("Temukan produk dan jasa dari tetangga sendiri.").notNull(),
  heroBackgroundUrl: text("heroBackgroundUrl"),
  heroBackgroundColor: varchar("heroBackgroundColor", { length: 20 }).default("#d45b39").notNull(),
  heroOverlayColor: varchar("heroOverlayColor", { length: 20 }).default("#7a2f2f").notNull(),
  heroOverlayOpacity: integer("heroOverlayOpacity").default(28).notNull(),
  heroBackgroundPosition: varchar("heroBackgroundPosition", { length: 20 }).default("center").notNull(),
  promoTitle: varchar("promoTitle", { length: 160 }).default("Promo warga Sawahan").notNull(),
  promoDescription: text("promoDescription").default("Temukan penawaran terbaru dari toko lokal.").notNull(),
  promoCta: varchar("promoCta", { length: 80 }).default("Jelajahi sekarang").notNull(),
  promoActive: integer("promoActive").default(1).notNull(),
  promoColor: varchar("promoColor", { length: 20 }).default("orange").notNull(),
  logoUrl: text("logoUrl"),
  bannerImageUrl: text("bannerImageUrl"),
  promoStartsAt: timestamp("promoStartsAt"),
  promoEndsAt: timestamp("promoEndsAt"),
  promoSlots: text("promoSlots"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const supportTicketStatusEnum = pgEnum("support_ticket_status", ["open", "in_progress", "resolved"]);

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketCode: varchar("ticketCode", { length: 32 }).notNull().unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
  context: varchar("context", { length: 180 }).notNull(),
  message: text("message").notNull(),
  status: supportTicketStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const visitorStats = pgTable("visitor_stats", {
  id: serial("id").primaryKey(),
  totalVisits: integer("totalVisits").default(0).notNull(),
  todayVisits: integer("todayVisits").default(0).notNull(),
  lastVisitDate: varchar("lastVisitDate", { length: 10 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const adminProfiles = pgTable("admin_profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  verifiedAt: timestamp("verifiedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const userAccounts = pgTable("user_accounts", {
  id: serial("id").primaryKey(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  isBuyer: integer("isBuyer").default(0).notNull(),
  isSeller: integer("isSeller").default(0).notNull(),
  isCourier: integer("isCourier").default(0).notNull(),
  isAdmin: integer("isAdmin").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  adminName: varchar("adminName", { length: 160 }).notNull(),
  adminWhatsapp: varchar("adminWhatsapp", { length: 32 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  targetRole: varchar("targetRole", { length: 20 }).notNull(),
  targetId: integer("targetId").notNull(),
  targetName: varchar("targetName", { length: 180 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sellerId: integer("sellerId"),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").default(0).notNull(),
  imageUrl: text("imageUrl"),
  vendor: varchar("vendor", { length: 160 }).notNull(),
  location: varchar("location", { length: 100 }).notNull(),
  status: productStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderCode: varchar("orderCode", { length: 32 }).notNull().unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
  village: varchar("village", { length: 80 }).notNull(),
  address: text("address").notNull(),
  currentLocation: text("currentLocation"),
  pickupLocation: text("pickupLocation"),
  routeDistanceKm: integer("routeDistanceKm"),
  note: text("note"),
  subtotal: integer("subtotal").notNull(),
  handlingFee: integer("handlingFee").default(0).notNull(),
  delivery: integer("delivery").notNull(),
  total: integer("total").notNull(),
  payment: varchar("payment", { length: 30 }).notNull(),
  status: orderStatusEnum("status").default("Menunggu").notNull(),
  courierId: integer("courierId"),
  courierAcceptedAt: timestamp("courierAcceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  productId: integer("productId"),
  productName: varchar("productName", { length: 180 }).notNull(),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type CourierProfile = typeof courierProfiles.$inferSelect;
export type BuyerProfile = typeof buyerProfiles.$inferSelect;
export type AdminProfile = typeof adminProfiles.$inferSelect;
export type UserAccount = typeof userAccounts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;

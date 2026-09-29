import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sellerProfiles = mysqlTable("seller_profiles", {
  id: int("id").autoincrement().primaryKey(),
  shopName: varchar("shopName", { length: 160 }).notNull(),
  ownerName: varchar("ownerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  village: varchar("village", { length: 80 }).notNull(),
  verifiedAt: timestamp("verifiedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const courierProfiles = mysqlTable("courier_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  vehicle: varchar("vehicle", { length: 40 }).notNull(),
  verifiedAt: timestamp("verifiedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const buyerProfiles = mysqlTable("buyer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull().unique(),
  village: varchar("village", { length: 80 }).notNull(),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  sellerId: int("sellerId"),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  price: int("price").notNull(),
  stock: int("stock").default(0).notNull(),
  vendor: varchar("vendor", { length: 160 }).notNull(),
  location: varchar("location", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["draft", "approved", "archived"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderCode: varchar("orderCode", { length: 32 }).notNull().unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
  village: varchar("village", { length: 80 }).notNull(),
  address: text("address").notNull(),
  note: text("note"),
  subtotal: int("subtotal").notNull(),
  delivery: int("delivery").notNull(),
  total: int("total").notNull(),
  payment: varchar("payment", { length: 30 }).notNull(),
  status: mysqlEnum("status", ["Menunggu", "Diproses", "Diantar", "Selesai", "Dibatalkan"]).default("Menunggu").notNull(),
  courierId: int("courierId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  productName: varchar("productName", { length: 180 }).notNull(),
  price: int("price").notNull(),
  quantity: int("quantity").notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type SellerProfile = typeof sellerProfiles.$inferSelect;
export type CourierProfile = typeof courierProfiles.$inferSelect;
export type BuyerProfile = typeof buyerProfiles.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

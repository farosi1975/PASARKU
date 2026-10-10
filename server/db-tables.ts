import * as postgresTables from "../drizzle/schema";
import * as mysqlTables from "../drizzle/schema.mysql";

const databaseUrl = process.env.DATABASE_URL?.trim().toLowerCase() ?? "";
const isMySql = databaseUrl.startsWith("mysql://") || databaseUrl.startsWith("mysql2://");

// Query helpers and routers share one table namespace. The runtime schema is
// selected once at startup so the preview (TiDB/MySQL) and production (Neon/PostgreSQL)
// can use the same business logic without mixing dialect-specific table objects.
const tables = (isMySql ? mysqlTables : postgresTables) as typeof postgresTables;

export const {
  users,
  sellerProfiles,
  courierProfiles,
  buyerProfiles,
  shippingSettings,
  siteSettings,
  supportTickets,
  visitorStats,
  adminProfiles,
  userAccounts,
  adminAuditLogs,
  products,
  orders,
  orderItems,
} = tables;

export const databaseDialect = isMySql ? "mysql" : "postgres" as const;

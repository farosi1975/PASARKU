import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const postgresSchema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const mysqlSchema = readFileSync(new URL("../drizzle/schema.mysql.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../drizzle/migrations/0029_courier_reassignment_foundation.sql", import.meta.url), "utf8");

describe("courier reassignment foundation", () => {
  it("keeps response metadata in both database schemas", () => {
    for (const schema of [postgresSchema, mysqlSchema]) {
      expect(schema).toContain("courierResponseStatus");
      expect(schema).toContain("courierResponseDeadline");
      expect(schema).toContain("courierReminderSentAt");
      expect(schema).toContain("orderCourierAttempts");
    }
  });

  it("stores the full courier attempt history without destructive SQL", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "order_courier_attempts"');
    expect(migration).toContain('"reason" varchar(80)');
    expect(migration).toContain('"note" text');
    expect(migration).toContain('"reminderSentAt" timestamp');
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});

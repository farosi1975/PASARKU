CREATE TABLE IF NOT EXISTS "promo_notification_deliveries" (
  "id" serial PRIMARY KEY,
  "slotId" varchar(120) NOT NULL,
  "endpoint" text NOT NULL,
  "sentAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "promo_notification_deliveries_slot_endpoint_idx" UNIQUE ("slotId", "endpoint")
);

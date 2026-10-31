ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierResponseStatus" varchar(20) DEFAULT 'not_assigned' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierResponseDeadline" timestamp;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courierReminderSentAt" timestamp;

CREATE TABLE IF NOT EXISTS "order_courier_attempts" (
  "id" serial PRIMARY KEY,
  "orderId" integer NOT NULL,
  "courierId" integer NOT NULL,
  "status" varchar(20) DEFAULT 'assigned' NOT NULL,
  "reason" varchar(80),
  "note" text,
  "assignedAt" timestamp DEFAULT now() NOT NULL,
  "reminderSentAt" timestamp,
  "respondedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

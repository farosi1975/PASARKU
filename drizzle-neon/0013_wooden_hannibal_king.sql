ALTER TABLE "orders" ADD COLUMN "handlingFee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_settings" ADD COLUMN "handlingFeePercent" integer DEFAULT 0 NOT NULL;
ALTER TABLE "site_settings" ADD COLUMN "logoUrl" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "bannerImageUrl" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "promoStartsAt" timestamp;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "promoEndsAt" timestamp;
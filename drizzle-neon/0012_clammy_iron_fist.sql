ALTER TABLE "site_settings" ADD COLUMN "heroBackgroundUrl" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "heroBackgroundColor" varchar(20) DEFAULT '#d45b39' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "heroOverlayColor" varchar(20) DEFAULT '#7a2f2f' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "heroOverlayOpacity" integer DEFAULT 28 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "heroBackgroundPosition" varchar(20) DEFAULT 'center' NOT NULL;
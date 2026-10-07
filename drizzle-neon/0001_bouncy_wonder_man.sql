ALTER TABLE "orders" ADD COLUMN "pickupLocation" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "routeDistanceKm" integer;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "currentLocation" text;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "openingTime" varchar(5) DEFAULT '08:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD COLUMN "closingTime" varchar(5) DEFAULT '20:00' NOT NULL;
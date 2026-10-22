ALTER TABLE "buyer_profiles" ADD COLUMN IF NOT EXISTS "referralCode" varchar(24);
--> statement-breakpoint
ALTER TABLE "buyer_profiles" ADD COLUMN IF NOT EXISTS "referredByCode" varchar(24);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "buyer_profiles_referralCode_idx" ON "buyer_profiles" ("referralCode");

ALTER TABLE `courier_profiles` MODIFY COLUMN `verificationStatus` enum('pending','verified','rejected','unverified') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `seller_profiles` MODIFY COLUMN `verificationStatus` enum('pending','verified','rejected','unverified') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `buyer_profiles` ADD `verificationStatus` enum('pending','verified','unverified') DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE `buyer_profiles` ADD `isBanned` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `courier_profiles` ADD `isBanned` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD `isBanned` int DEFAULT 0 NOT NULL;
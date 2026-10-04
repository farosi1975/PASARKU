ALTER TABLE `courier_profiles` MODIFY COLUMN `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `seller_profiles` MODIFY COLUMN `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `courier_profiles` ADD `verificationStatus` enum('pending','verified','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD `verificationStatus` enum('pending','verified','rejected') DEFAULT 'pending' NOT NULL;
ALTER TABLE `orders` ADD `courierAcceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `products` ADD `imageUrl` text;--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD `preferredCourierId` int;
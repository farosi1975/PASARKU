CREATE TABLE `shipping_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ratePerKm` int NOT NULL DEFAULT 3000,
	`discountPercent` int NOT NULL DEFAULT 0,
	`originLatitude` varchar(32) NOT NULL DEFAULT '-7.602345',
	`originLongitude` varchar(32) NOT NULL DEFAULT '111.904321',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `seller_profiles` ADD `freeShipping` int DEFAULT 0 NOT NULL;
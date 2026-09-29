CREATE TABLE `buyer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`village` varchar(80) NOT NULL,
	`address` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buyer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `buyer_profiles_whatsapp_unique` UNIQUE(`whatsapp`)
);

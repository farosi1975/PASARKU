CREATE TABLE `admin_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`verifiedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_profiles_whatsapp_unique` UNIQUE(`whatsapp`)
);

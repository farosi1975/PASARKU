CREATE TABLE `user_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`isBuyer` int NOT NULL DEFAULT 0,
	`isSeller` int NOT NULL DEFAULT 0,
	`isCourier` int NOT NULL DEFAULT 0,
	`isAdmin` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_accounts_whatsapp_unique` UNIQUE(`whatsapp`)
);

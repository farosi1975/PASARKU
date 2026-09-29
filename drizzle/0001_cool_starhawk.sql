CREATE TABLE `courier_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`vehicle` varchar(40) NOT NULL,
	`verifiedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courier_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `courier_profiles_whatsapp_unique` UNIQUE(`whatsapp`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`productName` varchar(180) NOT NULL,
	`price` int NOT NULL,
	`quantity` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderCode` varchar(32) NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`village` varchar(80) NOT NULL,
	`address` text NOT NULL,
	`note` text,
	`subtotal` int NOT NULL,
	`delivery` int NOT NULL,
	`total` int NOT NULL,
	`payment` varchar(30) NOT NULL,
	`status` enum('Menunggu','Diproses','Diantar','Selesai','Dibatalkan') NOT NULL DEFAULT 'Menunggu',
	`courierId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderCode_unique` UNIQUE(`orderCode`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerId` int,
	`name` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`price` int NOT NULL,
	`stock` int NOT NULL DEFAULT 0,
	`vendor` varchar(160) NOT NULL,
	`location` varchar(100) NOT NULL,
	`status` enum('draft','approved','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shopName` varchar(160) NOT NULL,
	`ownerName` varchar(160) NOT NULL,
	`whatsapp` varchar(32) NOT NULL,
	`village` varchar(80) NOT NULL,
	`verifiedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `seller_profiles_whatsapp_unique` UNIQUE(`whatsapp`)
);

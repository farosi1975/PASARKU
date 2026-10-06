CREATE TYPE "public"."buyer_verification_status" AS ENUM('pending', 'verified', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('Menunggu', 'Diproses', 'Diantar', 'Selesai', 'Dibatalkan');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected', 'unverified');--> statement-breakpoint
CREATE TABLE "admin_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"whatsapp" varchar(32) NOT NULL,
	"verifiedAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_profiles_whatsapp_unique" UNIQUE("whatsapp")
);
--> statement-breakpoint
CREATE TABLE "buyer_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"whatsapp" varchar(32) NOT NULL,
	"village" varchar(80) NOT NULL,
	"address" text,
	"verificationStatus" "buyer_verification_status" DEFAULT 'verified' NOT NULL,
	"isBanned" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_profiles_whatsapp_unique" UNIQUE("whatsapp")
);
--> statement-breakpoint
CREATE TABLE "courier_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"whatsapp" varchar(32) NOT NULL,
	"vehicle" varchar(40) NOT NULL,
	"village" varchar(80) DEFAULT 'Sawahan' NOT NULL,
	"address" text,
	"verificationStatus" "verification_status" DEFAULT 'pending' NOT NULL,
	"isBanned" integer DEFAULT 0 NOT NULL,
	"verifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "courier_profiles_whatsapp_unique" UNIQUE("whatsapp")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"productId" integer,
	"productName" varchar(180) NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderCode" varchar(32) NOT NULL,
	"customerName" varchar(160) NOT NULL,
	"whatsapp" varchar(32) NOT NULL,
	"village" varchar(80) NOT NULL,
	"address" text NOT NULL,
	"currentLocation" text,
	"note" text,
	"subtotal" integer NOT NULL,
	"delivery" integer NOT NULL,
	"total" integer NOT NULL,
	"payment" varchar(30) NOT NULL,
	"status" "order_status" DEFAULT 'Menunggu' NOT NULL,
	"courierId" integer,
	"courierAcceptedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_orderCode_unique" UNIQUE("orderCode")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"sellerId" integer,
	"name" varchar(180) NOT NULL,
	"category" varchar(80) NOT NULL,
	"price" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"imageUrl" text,
	"vendor" varchar(160) NOT NULL,
	"location" varchar(100) NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopName" varchar(160) NOT NULL,
	"ownerName" varchar(160) NOT NULL,
	"whatsapp" varchar(32) NOT NULL,
	"village" varchar(80) NOT NULL,
	"preferredCourierId" integer,
	"isOpen" integer DEFAULT 1 NOT NULL,
	"freeShipping" integer DEFAULT 0 NOT NULL,
	"verificationStatus" "verification_status" DEFAULT 'pending' NOT NULL,
	"isBanned" integer DEFAULT 0 NOT NULL,
	"verifiedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seller_profiles_whatsapp_unique" UNIQUE("whatsapp")
);
--> statement-breakpoint
CREATE TABLE "shipping_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"ratePerKm" integer DEFAULT 3000 NOT NULL,
	"discountPercent" integer DEFAULT 0 NOT NULL,
	"originLatitude" varchar(32) DEFAULT '-7.602345' NOT NULL,
	"originLongitude" varchar(32) DEFAULT '111.904321' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"whatsapp" varchar(32) NOT NULL,
	"displayName" varchar(160) NOT NULL,
	"isBuyer" integer DEFAULT 0 NOT NULL,
	"isSeller" integer DEFAULT 0 NOT NULL,
	"isCourier" integer DEFAULT 0 NOT NULL,
	"isAdmin" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_accounts_whatsapp_unique" UNIQUE("whatsapp")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);

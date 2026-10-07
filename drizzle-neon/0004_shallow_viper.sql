CREATE TYPE "public"."support_ticket_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketCode" varchar(32) NOT NULL,
	"customerName" varchar(160) NOT NULL,
	"whatsapp" varchar(32) NOT NULL,
	"context" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"status" "support_ticket_status" DEFAULT 'open' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_ticketCode_unique" UNIQUE("ticketCode")
);
--> statement-breakpoint
ALTER TABLE "shipping_settings" ADD COLUMN "supportOpeningTime" varchar(5) DEFAULT '08:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_settings" ADD COLUMN "supportClosingTime" varchar(5) DEFAULT '20:00' NOT NULL;
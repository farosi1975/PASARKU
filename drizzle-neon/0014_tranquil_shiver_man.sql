CREATE TABLE "admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"adminName" varchar(160) NOT NULL,
	"adminWhatsapp" varchar(32) NOT NULL,
	"action" varchar(80) NOT NULL,
	"targetRole" varchar(20) NOT NULL,
	"targetId" integer NOT NULL,
	"targetName" varchar(180) NOT NULL,
	"details" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);

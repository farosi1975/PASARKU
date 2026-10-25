CREATE TABLE IF NOT EXISTS "tax_cash_entries" (
  "id" serial PRIMARY KEY,
  "entryDate" varchar(10) NOT NULL,
  "voucherNo" varchar(80) NOT NULL,
  "category" varchar(80) NOT NULL,
  "description" text NOT NULL,
  "income" integer DEFAULT 0 NOT NULL,
  "expense" integer DEFAULT 0 NOT NULL,
  "pphStatus" varchar(40) DEFAULT 'Bukan Omzet' NOT NULL,
  "paymentStatus" varchar(40) DEFAULT 'Belum Dibayar' NOT NULL,
  "billingCode" varchar(120),
  "merchantName" varchar(160),
  "sourceType" varchar(30) DEFAULT 'manual' NOT NULL,
  "sourceId" varchar(80),
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tax_cash_entries_source_idx" UNIQUE ("sourceType", "sourceId")
);

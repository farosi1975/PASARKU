CREATE TABLE IF NOT EXISTS "region_regencies" (
  "code" varchar(8) PRIMARY KEY NOT NULL,
  "name" varchar(120) NOT NULL,
  "capital" varchar(120),
  "isOperational" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "region_districts" (
  "code" varchar(12) PRIMARY KEY NOT NULL,
  "regencyCode" varchar(8) NOT NULL,
  "name" varchar(120) NOT NULL,
  "isOperational" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "region_villages" (
  "code" varchar(16) PRIMARY KEY NOT NULL,
  "districtCode" varchar(12) NOT NULL,
  "name" varchar(160) NOT NULL,
  "type" varchar(24) DEFAULT 'Desa' NOT NULL,
  "isOperational" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "region_districts_regency_idx" ON "region_districts" ("regencyCode");
CREATE INDEX IF NOT EXISTS "region_villages_district_idx" ON "region_villages" ("districtCode");

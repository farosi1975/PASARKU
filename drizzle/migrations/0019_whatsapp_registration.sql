CREATE TABLE IF NOT EXISTS "whatsapp_registration_requests" (
  "id" serial PRIMARY KEY,
  "requestCode" varchar(40) NOT NULL UNIQUE,
  "whatsapp" varchar(32),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

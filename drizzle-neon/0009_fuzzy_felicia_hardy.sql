CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"brandName" varchar(80) DEFAULT 'PASARKU' NOT NULL,
	"tagline" varchar(180) DEFAULT 'Belanja dekat, berdampak hebat.' NOT NULL,
	"heroTitle" varchar(180) DEFAULT 'Belanja dekat,' NOT NULL,
	"heroHighlight" varchar(180) DEFAULT 'berdampak hebat.' NOT NULL,
	"heroDescription" text DEFAULT 'Temukan produk dan jasa dari tetangga sendiri.' NOT NULL,
	"promoTitle" varchar(160) DEFAULT 'Promo warga Sawahan' NOT NULL,
	"promoDescription" text DEFAULT 'Temukan penawaran terbaru dari toko lokal.' NOT NULL,
	"promoCta" varchar(80) DEFAULT 'Jelajahi sekarang' NOT NULL,
	"promoActive" integer DEFAULT 1 NOT NULL,
	"promoColor" varchar(20) DEFAULT 'orange' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

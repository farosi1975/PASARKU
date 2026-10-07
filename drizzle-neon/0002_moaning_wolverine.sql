CREATE TABLE "visitor_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"totalVisits" integer DEFAULT 0 NOT NULL,
	"todayVisits" integer DEFAULT 0 NOT NULL,
	"lastVisitDate" varchar(10) NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);

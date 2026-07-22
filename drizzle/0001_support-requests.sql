CREATE TABLE "support_request" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "support_request_ip_hash_created_at_idx" ON "support_request" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "support_request_email_created_at_idx" ON "support_request" USING btree ("email","created_at");
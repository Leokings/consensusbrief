CREATE TABLE "briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"share_slug" text NOT NULL,
	"creator_wallet" text NOT NULL,
	"request_title" text NOT NULL,
	"source_text" text NOT NULL,
	"source_word_count" integer NOT NULL,
	"target_words" integer NOT NULL,
	"result_word_count" integer NOT NULL,
	"contract_record" jsonb NOT NULL,
	"contract_address" text NOT NULL,
	"transaction_hash" text NOT NULL,
	"chain_id" integer DEFAULT 61999 NOT NULL,
	"chain_status" text NOT NULL,
	"contract_created_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefs_chain_status_check" CHECK ("briefs"."chain_status" in ('ACCEPTED', 'FINALIZED')),
	CONSTRAINT "briefs_target_words_check" CHECK ("briefs"."target_words" in (200, 400, 600)),
	CONSTRAINT "briefs_source_word_count_check" CHECK ("briefs"."source_word_count" between 50 and 600),
	CONSTRAINT "briefs_result_word_count_check" CHECK ("briefs"."result_word_count" between 160 and 600),
	CONSTRAINT "briefs_chain_id_check" CHECK ("briefs"."chain_id" = 61999)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "briefs_share_slug_unique" ON "briefs" USING btree ("share_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "briefs_transaction_hash_unique" ON "briefs" USING btree ("transaction_hash");--> statement-breakpoint
CREATE INDEX "briefs_creator_created_idx" ON "briefs" USING btree ("creator_wallet","contract_created_at");--> statement-breakpoint
CREATE INDEX "briefs_recent_idx" ON "briefs" USING btree ("contract_created_at");
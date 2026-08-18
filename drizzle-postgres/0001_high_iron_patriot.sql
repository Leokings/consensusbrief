ALTER TABLE "briefs" DROP CONSTRAINT "briefs_target_words_check";--> statement-breakpoint
ALTER TABLE "briefs" DROP CONSTRAINT "briefs_source_word_count_check";--> statement-breakpoint
ALTER TABLE "briefs" DROP CONSTRAINT "briefs_result_word_count_check";--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_target_words_check" CHECK ("briefs"."target_words" in (200, 400, 600, 1000));--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_source_word_count_check" CHECK ("briefs"."source_word_count" between 50 and 3000);--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_result_word_count_check" CHECK ("briefs"."result_word_count" between 160 and 1000);
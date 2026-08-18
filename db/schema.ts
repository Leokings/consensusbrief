import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ConsensusBriefRecord } from "@/lib/brief";

export const briefs = pgTable(
  "briefs",
  {
    id: text("id").primaryKey(),
    shareSlug: text("share_slug").notNull(),
    creatorWallet: text("creator_wallet").notNull(),
    requestTitle: text("request_title").notNull(),
    sourceText: text("source_text").notNull(),
    sourceWordCount: integer("source_word_count").notNull(),
    targetWords: integer("target_words").notNull(),
    resultWordCount: integer("result_word_count").notNull(),
    contractRecord: jsonb("contract_record")
      .$type<ConsensusBriefRecord>()
      .notNull(),
    contractAddress: text("contract_address").notNull(),
    transactionHash: text("transaction_hash").notNull(),
    chainId: integer("chain_id").notNull().default(61_999),
    chainStatus: text("chain_status").notNull(),
    contractCreatedAt: timestamp("contract_created_at", {
      withTimezone: true,
    }).notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("briefs_share_slug_unique").on(table.shareSlug),
    uniqueIndex("briefs_transaction_hash_unique").on(table.transactionHash),
    index("briefs_creator_created_idx").on(
      table.creatorWallet,
      table.contractCreatedAt,
    ),
    index("briefs_recent_idx").on(table.contractCreatedAt),
    check(
      "briefs_chain_status_check",
      sql`${table.chainStatus} in ('ACCEPTED', 'FINALIZED')`,
    ),
    check(
      "briefs_target_words_check",
      sql`${table.targetWords} in (200, 400, 600, 1000)`,
    ),
    check(
      "briefs_source_word_count_check",
      sql`${table.sourceWordCount} between 50 and 5000`,
    ),
    check(
      "briefs_result_word_count_check",
      sql`${table.resultWordCount} between 160 and 1000`,
    ),
    check("briefs_chain_id_check", sql`${table.chainId} = 61999`),
  ],
);

export type BriefRow = typeof briefs.$inferSelect;

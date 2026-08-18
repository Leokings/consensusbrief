import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./index";
import { briefs, type BriefRow } from "./schema";
import type { ConsensusBriefRecord } from "@/lib/brief";

export async function indexContractBrief(input: {
  record: ConsensusBriefRecord;
  transactionHash: string;
  contractAddress: string;
  chainStatus: "ACCEPTED" | "FINALIZED";
}): Promise<BriefRow> {
  const { record, transactionHash, contractAddress, chainStatus } = input;
  const createdAt = new Date(record.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("The contract returned an invalid creation date.");
  }

  const [row] = await getDb()
    .insert(briefs)
    .values({
      id: record.id,
      shareSlug: record.id,
      creatorWallet: record.creator.toLowerCase(),
      requestTitle: record.request_title,
      sourceText: record.source_text,
      sourceWordCount: record.source_word_count,
      targetWords: record.target_words,
      resultWordCount: record.brief.word_count,
      contractRecord: record,
      contractAddress: contractAddress.toLowerCase(),
      transactionHash: transactionHash.toLowerCase(),
      chainId: 61_999,
      chainStatus,
      contractCreatedAt: createdAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: briefs.id,
      set: {
        contractRecord: record,
        resultWordCount: record.brief.word_count,
        chainStatus,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) throw new Error("The brief could not be indexed.");
  return row;
}

export async function getBriefBySlug(
  slug: string,
  contractAddress: string,
): Promise<BriefRow | null> {
  const [row] = await getDb()
    .select()
    .from(briefs)
    .where(
      and(
        eq(briefs.shareSlug, slug),
        eq(briefs.contractAddress, contractAddress.toLowerCase()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getBriefsByCreator(
  creatorWallet: string,
  contractAddress: string,
  limit = 100,
): Promise<BriefRow[]> {
  return getDb()
    .select()
    .from(briefs)
    .where(
      and(
        eq(briefs.creatorWallet, creatorWallet.toLowerCase()),
        eq(briefs.contractAddress, contractAddress.toLowerCase()),
      ),
    )
    .orderBy(desc(briefs.contractCreatedAt))
    .limit(Math.max(1, Math.min(limit, 100)));
}

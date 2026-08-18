"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { indexContractBrief } from "@/db/queries";
import { briefIdPattern, transactionHashPattern } from "@/lib/brief";
import { getContractAddress } from "@/lib/deployment";
import {
  readContractBrief,
  verifyBriefTransaction,
} from "@/lib/genlayer-server";

const indexInputSchema = z.object({
  briefId: z.string().regex(briefIdPattern),
  transactionHash: z.string().regex(transactionHashPattern),
});

export type IndexBriefResult =
  | { ok: true; sharePath: string }
  | { ok: false; message: string };

export async function indexAcceptedBrief(
  input: z.infer<typeof indexInputSchema>,
): Promise<IndexBriefResult> {
  try {
    const parsed = indexInputSchema.parse(input);
    const evidence = await verifyBriefTransaction({
      briefId: parsed.briefId,
      transactionHash: parsed.transactionHash as `0x${string}`,
    });
    const record = await readContractBrief(parsed.briefId, evidence.creator);
    if (record.creator.toLowerCase() !== evidence.creator.toLowerCase()) {
      throw new Error("The transaction sender does not match the brief creator.");
    }
    await indexContractBrief({
      record,
      transactionHash: parsed.transactionHash,
      contractAddress: getContractAddress(),
      chainStatus: evidence.status,
    });
    revalidatePath("/");
    return { ok: true, sharePath: `/b/${record.id}` };
  } catch (error) {
    console.error("Failed to index accepted brief", error);
    if (
      error instanceof Error &&
      error.message.startsWith("DATABASE_URL is unavailable")
    ) {
      return {
        ok: false,
        message: "The brief is on-chain. Sharing needs the database connection.",
      };
    }
    return {
      ok: false,
      message: "The brief is on-chain, but its share page could not be created.",
    };
  }
}

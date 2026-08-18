import "server-only";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { Hash } from "genlayer-js/types";
import {
  addressPattern,
  parseConsensusBriefRecord,
  type ConsensusBriefRecord,
} from "./brief";
import { getContractAddress } from "./deployment";

const readClient = createClient({ chain: studionet });

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function readContractBrief(
  briefId: string,
  readerAddress: `0x${string}`,
): Promise<ConsensusBriefRecord> {
  const client = createClient({ chain: studionet, account: readerAddress });
  const value = await client.readContract({
    address: getContractAddress(),
    functionName: "get_brief",
    args: [briefId],
  });
  return parseConsensusBriefRecord(value);
}

export async function verifyBriefTransaction(input: {
  briefId: string;
  transactionHash: `0x${string}`;
}): Promise<{
  status: "ACCEPTED" | "FINALIZED";
  creator: `0x${string}`;
}> {
  const transaction = await readClient.getTransaction({
    hash: input.transactionHash as Hash,
  });
  if (!transaction) throw new Error("StudioNet could not find the transaction.");

  const tx = objectValue(transaction);
  const recipient = stringValue(tx.recipient || tx.to_address || tx.to).toLowerCase();
  const sender = stringValue(tx.sender || tx.from_address);
  const status = stringValue(tx.statusName || tx.status_name).toUpperCase();
  const result = stringValue(tx.resultName || tx.result_name).toUpperCase();
  const executionResult = stringValue(
    tx.txExecutionResultName || tx.tx_execution_result_name,
  ).toUpperCase();
  const data = objectValue(tx.data);
  const calldata = objectValue(data.calldata);
  const readable = stringValue(calldata.readable);
  const consensus = objectValue(tx.consensus_data);
  const leaderReceipts = Array.isArray(consensus.leader_receipt)
    ? consensus.leader_receipt
    : [consensus.leader_receipt];
  const executionSucceeded = leaderReceipts.some((receipt) => {
    const leaderReceipt = objectValue(receipt);
    const receiptResult = objectValue(leaderReceipt.result);
    return (
      stringValue(leaderReceipt.execution_result).toUpperCase() === "SUCCESS" ||
      stringValue(receiptResult.status).toLowerCase() === "return"
    );
  });

  if (recipient !== getContractAddress().toLowerCase()) {
    throw new Error("The transaction targets a different contract.");
  }
  if (!addressPattern.test(sender)) {
    throw new Error("The transaction sender is invalid.");
  }
  if (status !== "ACCEPTED" && status !== "FINALIZED") {
    throw new Error("The transaction has not been accepted.");
  }
  if (
    executionResult !== "FINISHED_WITH_RETURN" &&
    (result !== "MAJORITY_AGREE" || !executionSucceeded)
  ) {
    throw new Error("The transaction did not finish successfully.");
  }
  if (!readable.includes("create_brief") || !readable.includes(input.briefId)) {
    throw new Error("The transaction does not create this brief.");
  }
  return {
    status,
    creator: sender as `0x${string}`,
  };
}

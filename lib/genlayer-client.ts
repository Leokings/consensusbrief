"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  type CalldataEncodable,
  ExecutionResult,
  type Hash,
  TransactionStatus,
} from "genlayer-js/types";
import type { BriefTarget, ConsensusBriefRecord } from "./brief";
import { parseConsensusBriefRecord } from "./brief";
import {
  getContractAddress,
  STUDIO_CHAIN_ID,
  STUDIO_EXPLORER_URL,
} from "./deployment";

type ProviderListener = (value: unknown) => void;

type BrowserProvider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: ProviderListener): void;
  removeListener?(
    event: "accountsChanged" | "chainChanged",
    listener: ProviderListener,
  ): void;
};

export type ConnectedWallet = {
  address: `0x${string}`;
  createBrief(input: {
    briefId: string;
    requestTitle: string;
    sourceText: string;
    targetWords: BriefTarget;
  }): Promise<`0x${string}`>;
};

const readClient = createClient({ chain: studionet });
const POLL_INTERVAL_MS = 8_000;
const POLL_RETRIES = 150;

function provider(): BrowserProvider {
  const browserWindow = window as typeof window & {
    ethereum?: BrowserProvider;
  };
  if (!browserWindow.ethereum) {
    throw new Error("Install MetaMask or another browser wallet to continue.");
  }
  return browserWindow.ethereum;
}

function assertAddress(value: unknown): asserts value is `0x${string}` {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/u.test(value)) {
    throw new Error("The wallet returned an invalid account.");
  }
}

export function isStudioChainId(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^0x[0-9a-f]+$/iu.test(value) &&
    Number.parseInt(value.slice(2), 16) === STUDIO_CHAIN_ID
  );
}

export async function switchToStudioNet(): Promise<void> {
  const walletProvider = provider();
  const chainId = `0x${STUDIO_CHAIN_ID.toString(16)}`;
  try {
    await walletProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? Number((error as { code?: unknown }).code)
        : 0;
    if (code !== 4902) throw error;
    await walletProvider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: studionet.name,
          nativeCurrency: studionet.nativeCurrency,
          rpcUrls: [...studionet.rpcUrls.default.http],
          blockExplorerUrls: [STUDIO_EXPLORER_URL],
        },
      ],
    });
  }
}

function assertSuccessfulExecution(
  receipt: unknown,
): void {
  const transaction = objectValue(receipt);
  const executionResult = stringValue(
    transaction.txExecutionResultName ??
      transaction.tx_execution_result_name ??
      transaction.execution_result,
  ).toUpperCase();
  const resultName = stringValue(
    transaction.resultName ?? transaction.result_name,
  ).toUpperCase();
  const consensus = objectValue(
    transaction.consensusData ?? transaction.consensus_data,
  );
  const rawLeaderReceipts =
    consensus.leaderReceipt ?? consensus.leader_receipt;
  const leaderReceipts = Array.isArray(rawLeaderReceipts)
    ? rawLeaderReceipts
    : rawLeaderReceipts
      ? [rawLeaderReceipts]
      : [];
  const returnedSuccessfully = leaderReceipts.some((value) => {
    const leaderReceipt = objectValue(value);
    const execution = stringValue(leaderReceipt.execution_result).toUpperCase();
    const result = objectValue(leaderReceipt.result);
    return execution === "SUCCESS" || stringValue(result.status) === "return";
  });
  const returnedWithError = leaderReceipts.some((value) => {
    const leaderReceipt = objectValue(value);
    const execution = stringValue(leaderReceipt.execution_result).toUpperCase();
    const result = objectValue(leaderReceipt.result);
    return (
      execution === "ERROR" ||
      execution === "FAILED" ||
      stringValue(result.status) === "error"
    );
  });

  if (
    executionResult === ExecutionResult.FINISHED_WITH_RETURN ||
    (resultName === "MAJORITY_AGREE" && returnedSuccessfully)
  ) {
    return;
  }
  if (
    executionResult === ExecutionResult.FINISHED_WITH_ERROR ||
    returnedWithError ||
    resultName.includes("DISAGREE") ||
    resultName === "NO_MAJORITY"
  ) {
    throw new Error("The validators rejected this brief.");
  }
  throw new Error("Validator consensus did not finish successfully.");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function waitForAcceptedBrief(
  hash: `0x${string}`,
): Promise<void> {
  const receipt = await readClient.waitForTransactionReceipt({
    hash: hash as Hash,
    status: TransactionStatus.ACCEPTED,
    interval: POLL_INTERVAL_MS,
    retries: POLL_RETRIES,
  });
  assertSuccessfulExecution(receipt);
}

export async function readBriefFromChain(
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

export async function connectWallet(accountHint?: string): Promise<ConnectedWallet> {
  const walletProvider = provider();
  const accounts = accountHint
    ? [accountHint]
    : await walletProvider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("No wallet account was selected.");
  }
  assertAddress(accounts[0]);
  const address = accounts[0];

  const currentChain = await walletProvider.request({ method: "eth_chainId" });
  if (!isStudioChainId(currentChain)) await switchToStudioNet();

  const writeClient = createClient({
    chain: studionet,
    account: address,
    provider: walletProvider,
  });
  await writeClient.connect("studionet");

  return {
    address,
    async createBrief(input) {
      return (await writeClient.writeContract({
        address: getContractAddress(),
        functionName: "create_brief",
        args: [
          input.briefId,
          input.requestTitle,
          input.sourceText,
          BigInt(input.targetWords),
        ] as CalldataEncodable[],
        value: 0n,
      })) as `0x${string}`;
    },
  };
}

export async function requestWalletAddress(): Promise<`0x${string}`> {
  const accounts = await provider().request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("No wallet account was selected.");
  }
  assertAddress(accounts[0]);
  return accounts[0];
}

export async function currentWalletAddress(): Promise<`0x${string}` | null> {
  let walletProvider: BrowserProvider;
  try {
    walletProvider = provider();
  } catch {
    return null;
  }

  const accounts = await walletProvider.request({ method: "eth_accounts" });
  if (!Array.isArray(accounts) || accounts.length === 0) return null;
  assertAddress(accounts[0]);
  return accounts[0];
}

export async function signWalletMessage(
  address: `0x${string}`,
  message: string,
): Promise<`0x${string}`> {
  const signature = await provider().request({
    method: "personal_sign",
    params: [message, address],
  });
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/u.test(signature)) {
    throw new Error("The wallet returned an invalid signature.");
  }
  return signature as `0x${string}`;
}

export function watchWallet(callbacks: {
  onAccountsChanged(accounts: string[]): void;
  onChainChanged(chainId: unknown): void;
}): () => void {
  let walletProvider: BrowserProvider;
  try {
    walletProvider = provider();
  } catch {
    return () => undefined;
  }
  const accountListener: ProviderListener = (value) => {
    callbacks.onAccountsChanged(
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [],
    );
  };
  const chainListener: ProviderListener = (value) =>
    callbacks.onChainChanged(value);
  walletProvider.on?.("accountsChanged", accountListener);
  walletProvider.on?.("chainChanged", chainListener);
  return () => {
    walletProvider.removeListener?.("accountsChanged", accountListener);
    walletProvider.removeListener?.("chainChanged", chainListener);
  };
}

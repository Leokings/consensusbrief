import { studionet } from "genlayer-js/chains";
import { addressPattern } from "./brief";

export const STUDIO_CHAIN_ID = studionet.id;
export const STUDIO_RPC_URL = studionet.rpcUrls.default.http[0];
export const STUDIO_EXPLORER_URL = "https://explorer-studio.genlayer.com";
export const CONSENSUS_BRIEF_STUDIONET_ADDRESS =
  "0xC4BDAb7644538207e7b779CaaeBC1B1C0CBaaA8B";

const configuredAddress =
  process.env.NEXT_PUBLIC_CONSENSUS_BRIEF_CONTRACT_ADDRESS?.trim() ||
  CONSENSUS_BRIEF_STUDIONET_ADDRESS;

export function isContractConfigured(): boolean {
  return addressPattern.test(configuredAddress);
}

export function getContractAddress(): `0x${string}` {
  if (!addressPattern.test(configuredAddress)) {
    throw new Error("The ConsensusBrief StudioNet contract is not configured.");
  }
  return configuredAddress as `0x${string}`;
}

export function transactionUrl(hash: string): string {
  return `${STUDIO_EXPLORER_URL.replace(/\/$/u, "")}/tx/${hash}`;
}

import "server-only";

import { randomUUID } from "node:crypto";
import { verifyMessage } from "viem";
import { z } from "zod";
import { addressPattern } from "./brief";

export const archiveSessionCookie = "consensusbrief_archive";

const CHALLENGE_PREFIX = "ConsensusBrief archive access\n";
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 2 * 60 * 1_000;

const challengeSchema = z.object({
  domain: z.string().min(1).max(255),
  address: z.string().regex(addressPattern),
  nonce: z.string().uuid(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

const tokenSchema = z.object({
  message: z.string().min(1).max(1_500),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/u),
});

type Challenge = z.infer<typeof challengeSchema>;

function normalizedDomain(value: string): string {
  return value.trim().toLowerCase();
}

function parseMessage(message: string): Challenge | null {
  if (!message.startsWith(CHALLENGE_PREFIX)) return null;
  try {
    return challengeSchema.parse(
      JSON.parse(message.slice(CHALLENGE_PREFIX.length)),
    );
  } catch {
    return null;
  }
}

export function createArchiveChallenge(address: string, domain: string) {
  const parsedAddress = z.string().regex(addressPattern).parse(address);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_LIFETIME_MS);
  const challenge: Challenge = {
    domain: normalizedDomain(domain),
    address: parsedAddress.toLowerCase(),
    nonce: randomUUID(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  return `${CHALLENGE_PREFIX}${JSON.stringify(challenge)}`;
}

export function encodeArchiveSession(message: string, signature: string) {
  return Buffer.from(JSON.stringify({ message, signature })).toString(
    "base64url",
  );
}

export async function verifyArchiveSession(
  token: string | undefined,
  domain: string,
): Promise<{ address: `0x${string}`; expiresAt: Date } | null> {
  if (!token) return null;

  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    const { message, signature } = tokenSchema.parse(decoded);
    const challenge = parseMessage(message);
    if (!challenge) return null;

    const issuedAt = new Date(challenge.issuedAt);
    const expiresAt = new Date(challenge.expiresAt);
    const now = Date.now();
    if (
      normalizedDomain(challenge.domain) !== normalizedDomain(domain) ||
      issuedAt.getTime() > now + CLOCK_SKEW_MS ||
      expiresAt.getTime() <= now ||
      expiresAt.getTime() - issuedAt.getTime() !== SESSION_LIFETIME_MS
    ) {
      return null;
    }

    const address = challenge.address.toLowerCase() as `0x${string}`;
    const valid = await verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    });
    return valid ? { address, expiresAt } : null;
  } catch {
    return null;
  }
}

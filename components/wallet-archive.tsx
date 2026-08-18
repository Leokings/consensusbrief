"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ArchiveResponse } from "@/lib/archive";
import {
  currentWalletAddress,
  requestWalletAddress,
  signWalletMessage,
  watchWallet,
} from "@/lib/genlayer-client";

type Phase = "LOADING" | "LOCKED" | "UNLOCKING" | "READY" | "ERROR";

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function unlockError(error: unknown) {
  const value = error as { code?: unknown; message?: unknown };
  const message = typeof value?.message === "string" ? value.message : "";
  if (Number(value?.code) === 4001 || /rejected|denied|cancelled/iu.test(message)) {
    return "Wallet request cancelled.";
  }
  if (message.includes("MetaMask")) return message;
  return "The archive could not be unlocked.";
}

async function clearArchiveSession() {
  await fetch("/api/archive/session", {
    method: "DELETE",
    credentials: "same-origin",
  }).catch(() => undefined);
}

export function WalletArchive({ databaseReady }: { databaseReady: boolean }) {
  const [phase, setPhase] = useState<Phase>("LOADING");
  const [archive, setArchive] = useState<ArchiveResponse | null>(null);
  const [error, setError] = useState("");

  const loadArchive = useCallback(async () => {
    if (!databaseReady) {
      setPhase("ERROR");
      setError("Archive unavailable.");
      return;
    }

    try {
      const response = await fetch("/api/archive", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.status === 401) {
        setArchive(null);
        setPhase("LOCKED");
        return;
      }
      if (!response.ok) throw new Error("Archive request failed.");
      setArchive((await response.json()) as ArchiveResponse);
      setError("");
      setPhase("READY");
    } catch {
      setError("The archive could not be loaded.");
      setPhase("ERROR");
    }
  }, [databaseReady]);

  const restoreArchive = useCallback(async () => {
    if (!databaseReady) {
      setPhase("ERROR");
      setError("Archive unavailable.");
      return;
    }

    try {
      const response = await fetch("/api/archive/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const session = (await response.json()) as { wallet?: unknown };
      if (typeof session.wallet !== "string") {
        setPhase("LOCKED");
        return;
      }

      const connected = await currentWalletAddress();
      if (!connected || connected.toLowerCase() !== session.wallet.toLowerCase()) {
        await clearArchiveSession();
        setPhase("LOCKED");
        return;
      }
      await loadArchive();
    } catch {
      setError("The archive could not be loaded.");
      setPhase("ERROR");
    }
  }, [databaseReady, loadArchive]);

  useEffect(() => {
    void restoreArchive();
    const refresh = () => void loadArchive();
    window.addEventListener("consensusbrief:archive-updated", refresh);
    return () =>
      window.removeEventListener("consensusbrief:archive-updated", refresh);
  }, [loadArchive, restoreArchive]);

  useEffect(
    () =>
      watchWallet({
        onAccountsChanged(accounts) {
          if (
            archive?.wallet &&
            accounts[0]?.toLowerCase() !== archive.wallet.toLowerCase()
          ) {
            void lockArchive();
          }
        },
        onChainChanged() {},
      }),
    [archive?.wallet],
  );

  async function unlockArchive() {
    setError("");
    setPhase("UNLOCKING");
    try {
      const address = await requestWalletAddress();
      const challengeResponse = await fetch("/api/archive/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const challenge = (await challengeResponse.json()) as {
        message?: unknown;
      };
      if (!challengeResponse.ok || typeof challenge.message !== "string") {
        throw new Error("Archive challenge failed.");
      }

      const signature = await signWalletMessage(address, challenge.message);
      const sessionResponse = await fetch("/api/archive/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: challenge.message, signature }),
      });
      if (!sessionResponse.ok) throw new Error("Archive verification failed.");
      await loadArchive();
    } catch (caught) {
      setError(unlockError(caught));
      setPhase("LOCKED");
    }
  }

  async function lockArchive() {
    await clearArchiveSession();
    setArchive(null);
    setError("");
    setPhase("LOCKED");
  }

  return (
    <section className="recent-section" id="archive">
      <div className="recent-heading">
        <div>
          <p className="section-kicker">Wallet-only</p>
          <h2>Your archive</h2>
        </div>
        {phase === "READY" && archive ? (
          <div className="archive-identity">
            <span>{shortAddress(archive.wallet)}</span>
            <button type="button" onClick={lockArchive}>Lock</button>
          </div>
        ) : null}
      </div>

      {phase === "LOADING" ? <p className="archive-empty">Loading…</p> : null}

      {phase === "LOCKED" || phase === "UNLOCKING" ? (
        <div className="archive-lock">
          <p>Verify your wallet to view your briefs.</p>
          <button
            type="button"
            onClick={unlockArchive}
            disabled={phase === "UNLOCKING"}
          >
            {phase === "UNLOCKING" ? "Check wallet…" : "Unlock archive"}
          </button>
          {error ? <span role="alert">{error}</span> : null}
        </div>
      ) : null}

      {phase === "ERROR" ? (
        <p className="archive-empty" role="alert">{error}</p>
      ) : null}

      {phase === "READY" && archive ? (
        archive.briefs.length ? (
          <div className="recent-grid">
            {archive.briefs.map((brief) => (
              <Link href={`/b/${brief.shareSlug}`} key={brief.id}>
                <div className="recent-card-meta">
                  <span>{brief.resultWordCount} words</span>
                  <i aria-hidden="true">↗</i>
                </div>
                <h3>{brief.title}</h3>
                <p>{brief.summary}</p>
                <time dateTime={brief.createdAt}>
                  {new Date(brief.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </Link>
            ))}
          </div>
        ) : (
          <p className="archive-empty">No briefs from this wallet yet.</p>
        )
      ) : null}
    </section>
  );
}

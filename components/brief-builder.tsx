"use client";

import { useEffect, useMemo, useState } from "react";
import { indexAcceptedBrief } from "@/app/actions";
import {
  BRIEF_TARGETS,
  composeSourceText,
  countWords,
  MAX_SOURCE_CHARACTERS,
  MAX_SOURCE_WORDS,
  newBriefId,
  SOURCE_MINIMUM_BY_TARGET,
  type BriefTarget,
  type ConsensusBriefRecord,
} from "@/lib/brief";
import { formatBriefText } from "@/lib/brief-format";
import { isContractConfigured, transactionUrl } from "@/lib/deployment";
import {
  connectWallet,
  readBriefFromChain,
  waitForAcceptedBrief,
  watchWallet,
  type ConnectedWallet,
} from "@/lib/genlayer-client";
import { BriefDocument } from "./brief-document";

type Phase = "IDLE" | "WALLET" | "CONSENSUS" | "INDEXING" | "READY";

type ArticleImportPayload = {
  url: string;
  title: string;
  text: string;
  wordCount: number;
  truncated: boolean;
};

function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function friendlyError(error: unknown): string {
  const value = error as { code?: unknown; message?: unknown };
  const message = typeof value?.message === "string" ? value.message : "";
  if (Number(value?.code) === 4001 || /rejected|denied|cancelled/iu.test(message)) {
    return "Wallet request cancelled.";
  }
  if (message.includes("source_too_short_for_target")) {
    return "Add more source material or choose a shorter output.";
  }
  if (message.includes("validators rejected")) {
    return "Validators could not agree on this brief. Try refining the source.";
  }
  if (/rate|429|-32429/iu.test(message)) {
    return "StudioNet is busy. Wait a minute and try again.";
  }
  if (/timeout|retries/iu.test(message)) {
    return "StudioNet is still processing the transaction. Check it before trying again.";
  }
  if (/brief_not_found|not readable/iu.test(message)) {
    return "The transaction was accepted, but the brief is not readable yet.";
  }
  if (message.includes("not configured")) {
    return "The StudioNet contract has not been connected yet.";
  }
  return "The brief could not be created. Please try again.";
}

export function BriefBuilder({ databaseReady }: { databaseReady: boolean }) {
  const [requestTitle, setRequestTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [importedUrl, setImportedUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [importing, setImporting] = useState(false);
  const [articleMessage, setArticleMessage] = useState("");
  const [articleError, setArticleError] = useState("");
  const [targetWords, setTargetWords] = useState<BriefTarget>(200);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | "">("");
  const [record, setRecord] = useState<ConsensusBriefRecord | null>(null);
  const [sharePath, setSharePath] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submittedSource = useMemo(
    () => composeSourceText(sourceText, importedUrl),
    [importedUrl, sourceText],
  );
  const sourceWords = useMemo(() => countWords(submittedSource), [submittedSource]);
  const sourceCharacters = submittedSource.length;
  const minimumWords = SOURCE_MINIMUM_BY_TARGET[targetWords];
  const submitting = phase !== "IDLE" && phase !== "READY";
  const contractReady = isContractConfigured();

  useEffect(
    () =>
      watchWallet({
        onAccountsChanged(accounts) {
          if (!accounts[0] || accounts[0].toLowerCase() !== wallet?.address.toLowerCase()) {
            setWallet(null);
          }
        },
        onChainChanged() {
          setWallet(null);
        },
      }),
    [wallet?.address],
  );

  async function connect(): Promise<ConnectedWallet | null> {
    setError("");
    try {
      const connected = await connectWallet();
      setWallet(connected);
      return connected;
    } catch (caught) {
      setError(friendlyError(caught));
      return null;
    }
  }

  async function importArticle() {
    const url = sourceUrl.trim();
    setArticleError("");
    setArticleMessage("");
    if (!url) {
      setArticleError("Enter an article URL.");
      return;
    }

    setImporting(true);
    try {
      const response = await fetch("/api/sources/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as Partial<ArticleImportPayload> & {
        error?: unknown;
      };
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "The article could not be imported.",
        );
      }
      if (
        typeof payload.url !== "string" ||
        typeof payload.title !== "string" ||
        typeof payload.text !== "string" ||
        typeof payload.wordCount !== "number" ||
        typeof payload.truncated !== "boolean"
      ) {
        throw new Error("The article returned an invalid response.");
      }

      const article: ArticleImportPayload = {
        url: payload.url,
        title: payload.title,
        text: payload.text,
        wordCount: payload.wordCount,
        truncated: payload.truncated,
      };
      setSourceUrl(article.url);
      setImportedUrl(article.url);
      setSourceText(article.text);
      setRequestTitle((current) => current.trim() || article.title);
      setArticleMessage(
        article.truncated
          ? `Imported ${article.wordCount}-word excerpt.`
          : `Imported ${article.wordCount} words.`,
      );
      setError("");
    } catch (caught) {
      setImportedUrl("");
      setArticleError(
        caught instanceof Error
          ? caught.message
          : "The article could not be imported.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function createBrief(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSharePath("");
    if (!contractReady) {
      setError("The StudioNet contract has not been connected yet.");
      return;
    }
    if (sourceUrl.trim() && !importedUrl) {
      setError("Import the article link first, or clear it.");
      return;
    }
    if (sourceWords < minimumWords) {
      setError(`This setting needs at least ${minimumWords} source words.`);
      return;
    }
    if (sourceWords > MAX_SOURCE_WORDS) {
      setError(`Source material cannot exceed ${MAX_SOURCE_WORDS} words.`);
      return;
    }
    if (sourceCharacters > MAX_SOURCE_CHARACTERS) {
      setError(`Source material cannot exceed ${MAX_SOURCE_CHARACTERS.toLocaleString()} characters.`);
      return;
    }

    setPhase("WALLET");
    const activeWallet = wallet ?? (await connect());
    if (!activeWallet) {
      setPhase("IDLE");
      return;
    }

    const briefId = newBriefId();
    try {
      const hash = await activeWallet.createBrief({
        briefId,
        requestTitle: requestTitle.trim(),
        sourceText: submittedSource,
        targetWords,
      });
      setTransactionHash(hash);
      setPhase("CONSENSUS");
      await waitForAcceptedBrief(hash);
      const acceptedRecord = await readBriefFromChain(
        briefId,
        activeWallet.address,
      );
      setRecord(acceptedRecord);
      setPhase("INDEXING");

      const indexed = await indexAcceptedBrief({
        briefId,
        transactionHash: hash,
      });
      if (indexed.ok) {
        setSharePath(indexed.sharePath);
        window.dispatchEvent(new Event("consensusbrief:archive-updated"));
      } else setNotice(indexed.message);
      setPhase("READY");
    } catch (caught) {
      setError(friendlyError(caught));
      setPhase("IDLE");
    }
  }

  async function copy(value: string, successMessage: string) {
    await navigator.clipboard.writeText(value);
    setNotice(successMessage);
  }

  function reset() {
    setRecord(null);
    setTransactionHash("");
    setSharePath("");
    setNotice("");
    setError("");
    setPhase("IDLE");
  }

  const phaseText: Record<Exclude<Phase, "IDLE" | "READY">, string> = {
    WALLET: "Confirm in wallet",
    CONSENSUS: "Validators reviewing",
    INDEXING: "Preparing share link",
  };

  if (record) {
    const publicUrl = sharePath ? `${window.location.origin}${sharePath}` : "";
    const indexing = phase === "INDEXING";
    return (
      <section className="result-shell" aria-live="polite">
        <div className="result-toolbar">
          <div>
            <p className="composer-eyebrow">
              {indexing ? "Preparing share link" : "Brief ready"}
            </p>
            <h2>Consensus accepted</h2>
          </div>
          <button className="text-button" type="button" onClick={reset}>
            Start another
          </button>
        </div>

        <div className="result-layout">
          <BriefDocument record={record} />

          <aside className="result-sidecar">
            <div>
              <p className="sidecar-label">Actions</p>
              <div className="result-actions">
                {sharePath ? (
                  <>
                    <button
                      type="button"
                      onClick={() => copy(publicUrl, "Share link copied.")}
                    >
                      Copy share link
                    </button>
                    <a href={`/api/briefs/${record.id}/export?format=pdf`}>PDF</a>
                    <a href={`/api/briefs/${record.id}/export?format=docx`}>DOCX</a>
                    <a href={`/api/briefs/${record.id}/export?format=txt`}>TXT</a>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      copy(formatBriefText(record), "Brief text copied.")
                    }
                  >
                    Copy brief
                  </button>
                )}
              </div>
            </div>
            {transactionHash ? (
              <div className="sidecar-proof">
                <p className="sidecar-label">On-chain record</p>
                <a
                  className="proof-link"
                  href={transactionUrl(transactionHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction <span aria-hidden="true">↗</span>
                </a>
              </div>
            ) : null}
          </aside>
        </div>
        {notice ? <p className="inline-notice">{notice}</p> : null}
      </section>
    );
  }

  return (
    <section className="composer-shell" id="create">
      <div className="composer-toolbar">
        <div>
          <p className="composer-eyebrow">New brief</p>
          <h2>Source</h2>
        </div>
        {wallet ? (
          <span className="wallet-pill">{shortAddress(wallet.address)}</span>
        ) : (
          <button className="connect-button" type="button" onClick={connect}>
            Connect wallet
          </button>
        )}
      </div>

      <form className="composer-grid" onSubmit={createBrief}>
        <div className="editor-panel">
          <div className="source-import">
            <label htmlFor="article-url">Article URL</label>
            <div className="source-url-row">
              <input
                id="article-url"
                type="url"
                inputMode="url"
                maxLength={2_048}
                value={sourceUrl}
                onChange={(event) => {
                  const value = event.target.value;
                  setSourceUrl(value);
                  setArticleError("");
                  if (value.trim() !== importedUrl) {
                    setImportedUrl("");
                    setArticleMessage("");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void importArticle();
                  }
                }}
                placeholder="https://…"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => void importArticle()}
                disabled={importing || !sourceUrl.trim()}
              >
                {importing ? "Importing…" : "Import article"}
              </button>
            </div>
            <div className="article-feedback" aria-live="polite">
              {articleError ? <span className="article-error">{articleError}</span> : null}
              {articleMessage ? <span>{articleMessage}</span> : null}
            </div>
          </div>

          <label className="field title-field">
            <span>
              Working title <small>Optional</small>
            </span>
            <input
              maxLength={120}
              value={requestTitle}
              onChange={(event) => setRequestTitle(event.target.value)}
              placeholder="Add a title"
            />
          </label>

          <label className="field source-field">
            <span>
              Source
              <small
                className={
                  sourceWords > MAX_SOURCE_WORDS ||
                  sourceCharacters > MAX_SOURCE_CHARACTERS
                    ? "count-over"
                    : ""
                }
              >
                {sourceCharacters > MAX_SOURCE_CHARACTERS
                  ? `${sourceCharacters.toLocaleString()} / ${MAX_SOURCE_CHARACTERS.toLocaleString()} characters`
                  : `${sourceWords} / ${MAX_SOURCE_WORDS} words`}
              </small>
            </span>
            <textarea
              maxLength={MAX_SOURCE_CHARACTERS}
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Article text appears here, or paste text…"
              required
            />
          </label>
        </div>

        <aside className="settings-panel">
          <div className="settings-heading">
            <h3>Brief length</h3>
          </div>

          <fieldset className="length-field">
            <legend>Words</legend>
            <div className="length-options">
              {BRIEF_TARGETS.map((target) => (
                <button
                  className={targetWords === target ? "selected" : ""}
                  key={target}
                  type="button"
                  onClick={() => setTargetWords(target)}
                >
                  <strong>{target}</strong>
                  <span>{SOURCE_MINIMUM_BY_TARGET[target]}+ source</span>
                </button>
              ))}
            </div>
          </fieldset>

          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {!databaseReady ? (
            <p className="setup-note">Sharing is temporarily unavailable.</p>
          ) : null}

          <button
            className="submit-button"
            type="submit"
            disabled={
              importing ||
              submitting ||
              sourceWords < minimumWords ||
              sourceWords > MAX_SOURCE_WORDS ||
              sourceCharacters > MAX_SOURCE_CHARACTERS
            }
          >
            <span>
              {phase === "IDLE"
                ? "Create brief"
                : phaseText[phase as Exclude<Phase, "IDLE" | "READY">]}
            </span>
            <i aria-hidden="true">→</i>
          </button>

          {sourceWords < minimumWords ? (
            <p className="minimum-note">{minimumWords - sourceWords} more words</p>
          ) : null}

          {transactionHash && phase !== "READY" ? (
            <a
              className="pending-proof"
              href={transactionUrl(transactionHash)}
              target="_blank"
              rel="noreferrer"
            >
              Transaction {shortAddress(transactionHash)}
            </a>
          ) : null}
        </aside>
      </form>
    </section>
  );
}

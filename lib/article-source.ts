import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import {
  countWords,
  MAX_SOURCE_CHARACTERS,
  MAX_SOURCE_WORDS,
} from "@/lib/brief";

const MAX_URL_LENGTH = 2_048;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 12_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type ArticleSource = {
  url: string;
  title: string;
  text: string;
  wordCount: number;
  truncated: boolean;
};

export class ArticleSourceError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "ArticleSourceError";
  }
}

function isBlockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return true;
  }

  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isBlockedAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  if (!normalized) return true;
  if (isIP(normalized) === 4) return isBlockedIpv4(normalized);

  const mappedIpv4 = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/u)?.[1];
  if (mappedIpv4) return isBlockedIpv4(mappedIpv4);
  if (isIP(normalized) !== 6) return true;

  const firstGroup = Number.parseInt(normalized.split(":")[0] || "0", 16);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    (firstGroup & 0xfe00) === 0xfc00 ||
    (firstGroup & 0xffc0) === 0xfe80 ||
    (firstGroup & 0xff00) === 0xff00 ||
    normalized.startsWith("100:") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("2001:2:") ||
    normalized.startsWith("2001:10:") ||
    normalized.startsWith("2001:20:")
  );
}

async function validatePublicUrl(value: string): Promise<URL> {
  if (!value || value.length > MAX_URL_LENGTH) {
    throw new ArticleSourceError("Enter a valid public article URL.", 400);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ArticleSourceError("Enter a valid public article URL.", 400);
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new ArticleSourceError("Enter a valid public article URL.", 400);
  }

  const expectedPort = url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== expectedPort) {
    throw new ArticleSourceError("That URL cannot be imported.", 400);
  }

  const hostname = url.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ArticleSourceError("That URL cannot be imported.", 400);
  }

  if (isIP(hostname) > 0) {
    if (isBlockedAddress(hostname)) {
      throw new ArticleSourceError("That URL cannot be imported.", 400);
    }
    return url;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ArticleSourceError("The article could not be reached.");
  }

  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new ArticleSourceError("That URL cannot be imported.", 400);
  }

  return url;
}

async function readLimitedBody(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new ArticleSourceError("That article is too large to import.");
  }

  if (!response.body) {
    throw new ArticleSourceError("The article returned no readable content.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ArticleSourceError("That article is too large to import.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function decodeBody(body: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/iu)?.[1];
  try {
    return new TextDecoder(charset || "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

async function fetchArticle(urlValue: string): Promise<{
  url: URL;
  contentType: string;
  body: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let url = await validatePublicUrl(urlValue);
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
          "User-Agent": "ConsensusBrief/1.0 (+https://consensusbrief.vercel.app)",
        },
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) {
          throw new ArticleSourceError("The article redirected too many times.");
        }
        url = await validatePublicUrl(new URL(location, url).toString());
        continue;
      }

      if (!response.ok) {
        throw new ArticleSourceError("The article could not be reached.");
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() || "";
      const supported =
        contentType.startsWith("text/html") ||
        contentType.startsWith("application/xhtml+xml") ||
        contentType.startsWith("text/plain");
      if (!supported) {
        throw new ArticleSourceError("That link is not an HTML or text article.");
      }

      const body = decodeBody(await readLimitedBody(response), contentType);
      return { url, contentType, body };
    }
  } catch (error) {
    if (error instanceof ArticleSourceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ArticleSourceError("The article took too long to respond.");
    }
    throw new ArticleSourceError("The article could not be reached.");
  } finally {
    clearTimeout(timer);
  }

  throw new ArticleSourceError("The article could not be reached.");
}

function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/gu, " ")
    .replace(/[\u200b-\u200d\ufeff]/gu, "")
    .split(/\n+/u)
    .map((line) => line.replace(/[ \t]+/gu, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function truncateSource(value: string, maximumWords: number, maximumCharacters: number): {
  text: string;
  truncated: boolean;
} {
  const matches = Array.from(value.matchAll(/\S+/gu));
  let text = value;
  let truncated = false;
  if (matches.length > maximumWords) {
    const last = matches[maximumWords - 1];
    const end = (last.index ?? 0) + last[0].length;
    text = value.slice(0, end).trimEnd();
    truncated = true;
  }
  if (text.length > maximumCharacters) {
    const characterSlice = text.slice(0, maximumCharacters + 1);
    const wordBoundary = characterSlice.search(/\s+\S*$/u);
    text = characterSlice.slice(0, wordBoundary > 0 ? wordBoundary : maximumCharacters).trimEnd();
    truncated = true;
  }
  return { text, truncated };
}

function titleFromUrl(url: URL): string {
  const lastPathPart = url.pathname.split("/").filter(Boolean).at(-1) || "";
  try {
    const decoded = decodeURIComponent(lastPathPart).replace(/[-_]+/gu, " ").trim();
    if (decoded) return decoded;
  } catch {
    // Fall through to the hostname.
  }
  return url.hostname.replace(/^www\./u, "");
}

export async function extractArticleSource(urlValue: string): Promise<ArticleSource> {
  const fetched = await fetchArticle(urlValue.trim());
  let title = "";
  let extracted = "";

  if (fetched.contentType.startsWith("text/plain")) {
    title = titleFromUrl(fetched.url);
    extracted = normalizeText(fetched.body);
  } else {
    const { document } = parseHTML(fetched.body);
    title = normalizeText(
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
        document.querySelector('meta[name="twitter:title"]')?.getAttribute("content") ||
        document.title ||
        "",
    );

    const readable = new Readability(document as unknown as Document, {
      charThreshold: 80,
    }).parse();
    extracted = normalizeText(readable?.textContent || "");
    title = normalizeText(readable?.title || title);

    if (countWords(extracted) < 20) {
      const fallback = parseHTML(fetched.body).document;
      fallback
        .querySelectorAll("script, style, noscript, nav, footer, header, aside, form, dialog, svg")
        .forEach((element) => element.remove());
      const main =
        fallback.querySelector("article, main, [role='main']") || fallback.body;
      extracted = normalizeText(main?.textContent || "");
    }
  }

  if (countWords(extracted) < 20) {
    throw new ArticleSourceError(
      "Enough article text could not be extracted. Paste the text instead.",
    );
  }

  const sourcePrefix = `Source URL: ${fetched.url.toString()}\n\n`;
  const limited = truncateSource(
    extracted,
    MAX_SOURCE_WORDS - countWords(sourcePrefix),
    MAX_SOURCE_CHARACTERS - sourcePrefix.length,
  );
  const finalTitle = (title || titleFromUrl(fetched.url)).slice(0, 120).trim();
  return {
    url: fetched.url.toString(),
    title: finalTitle,
    text: limited.text,
    wordCount: countWords(limited.text),
    truncated: limited.truncated,
  };
}

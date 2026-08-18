import { ArticleSourceError, extractArticleSource } from "@/lib/article-source";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 4_096) {
    return Response.json(
      { error: "The request is too large." },
      { status: 413, headers: RESPONSE_HEADERS },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { error: "Enter a valid public article URL." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  const url =
    typeof input === "object" && input !== null && "url" in input
      ? (input as { url?: unknown }).url
      : null;
  if (typeof url !== "string") {
    return Response.json(
      { error: "Enter a valid public article URL." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  try {
    const article = await extractArticleSource(url);
    return Response.json(article, { headers: RESPONSE_HEADERS });
  } catch (error) {
    if (error instanceof ArticleSourceError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: RESPONSE_HEADERS },
      );
    }
    console.error("Article extraction failed", error);
    return Response.json(
      { error: "The article could not be imported." },
      { status: 500, headers: RESPONSE_HEADERS },
    );
  }
}

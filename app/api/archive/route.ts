import { NextRequest, NextResponse } from "next/server";
import { getBriefsByCreator } from "@/db/queries";
import type { ArchiveResponse } from "@/lib/archive";
import {
  archiveSessionCookie,
  verifyArchiveSession,
} from "@/lib/archive-session";
import { getContractAddress } from "@/lib/deployment";

export async function GET(request: NextRequest) {
  const domain = request.headers.get("host") ?? request.nextUrl.host;
  const session = await verifyArchiveSession(
    request.cookies.get(archiveSessionCookie)?.value,
    domain,
  );
  if (!session) {
    return NextResponse.json(
      { error: "Wallet verification required." },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  try {
    const rows = await getBriefsByCreator(
      session.address,
      getContractAddress(),
    );
    const response: ArchiveResponse = {
      wallet: session.address,
      briefs: rows.map((row) => ({
        id: row.id,
        shareSlug: row.shareSlug,
        title: row.contractRecord.brief.title,
        summary: row.contractRecord.brief.executive_summary,
        resultWordCount: row.resultWordCount,
        createdAt: row.contractCreatedAt.toISOString(),
      })),
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Failed to load wallet archive", error);
    return NextResponse.json(
      { error: "The archive could not be loaded." },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}

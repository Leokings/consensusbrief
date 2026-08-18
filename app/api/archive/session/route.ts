import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  archiveSessionCookie,
  encodeArchiveSession,
  verifyArchiveSession,
} from "@/lib/archive-session";

const inputSchema = z.object({
  message: z.string().min(1).max(1_500),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/u),
});

function domain(request: NextRequest) {
  return request.headers.get("host") ?? request.nextUrl.host;
}

export async function GET(request: NextRequest) {
  const session = await verifyArchiveSession(
    request.cookies.get(archiveSessionCookie)?.value,
    domain(request),
  );
  return NextResponse.json(
    { wallet: session?.address ?? null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const { message, signature } = inputSchema.parse(await request.json());
    const token = encodeArchiveSession(message, signature);
    const session = await verifyArchiveSession(token, domain(request));
    if (!session) throw new Error("Invalid wallet signature.");

    const response = NextResponse.json(
      { wallet: session.address },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(archiveSessionCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "The wallet signature could not be verified." },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
  response.cookies.set(archiveSessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

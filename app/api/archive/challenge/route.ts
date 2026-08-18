import { NextResponse } from "next/server";
import { z } from "zod";
import { createArchiveChallenge } from "@/lib/archive-session";
import { addressPattern } from "@/lib/brief";

const inputSchema = z.object({
  address: z.string().regex(addressPattern),
});

export async function POST(request: Request) {
  try {
    const { address } = inputSchema.parse(await request.json());
    const domain = request.headers.get("host");
    if (!domain) throw new Error("Missing request domain.");

    return NextResponse.json(
      { message: createArchiveChallenge(address, domain) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "A valid wallet address is required." },
      { status: 400 },
    );
  }
}

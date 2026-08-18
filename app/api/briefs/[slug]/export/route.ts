import { getBriefBySlug } from "@/db/queries";
import { briefIdPattern } from "@/lib/brief";
import {
  buildDocxExport,
  buildPdfExport,
  buildTextExport,
} from "@/lib/document-export";
import { getContractAddress } from "@/lib/deployment";

type ExportFormat = "txt" | "pdf" | "docx";

const contentTypes: Record<ExportFormat, string> = {
  txt: "text/plain; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const format = new URL(request.url).searchParams.get("format") as ExportFormat;
  if (!briefIdPattern.test(slug) || !["txt", "pdf", "docx"].includes(format)) {
    return Response.json({ error: "Invalid export request." }, { status: 400 });
  }

  const row = await getBriefBySlug(slug, getContractAddress());
  if (!row) return Response.json({ error: "Brief not found." }, { status: 404 });
  const proof = {
    transactionHash: row.transactionHash,
    contractAddress: row.contractAddress,
  };
  let body: Uint8Array;
  if (format === "pdf") body = await buildPdfExport(row.contractRecord, proof);
  else if (format === "docx") {
    body = await buildDocxExport(row.contractRecord, proof);
  } else body = buildTextExport(row.contractRecord, proof);

  return new Response(Buffer.from(body), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${slug}.${format}"`,
      "Content-Type": contentTypes[format],
    },
  });
}

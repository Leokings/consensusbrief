import "server-only";

import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";
import type { ConsensusBriefRecord } from "./brief";
import { formatBriefText } from "./brief-format";

type Proof = { transactionHash: string; contractAddress: string };

export function buildTextExport(
  record: ConsensusBriefRecord,
  proof: Proof,
): Uint8Array {
  return new TextEncoder().encode(formatBriefText(record, proof));
}

function bulletParagraph(value: string): Paragraph {
  return new Paragraph({
    text: value,
    bullet: { level: 0 },
    spacing: { after: 110 },
  });
}

function heading(value: string): Paragraph {
  return new Paragraph({
    text: value,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 110 },
  });
}

export async function buildDocxExport(
  record: ConsensusBriefRecord,
  proof: Proof,
): Promise<Uint8Array> {
  const document = new Document({
    creator: "ConsensusBrief",
    title: record.brief.title,
    description: "A validator-backed brief created on GenLayer StudioNet.",
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `ConsensusBrief · ${record.id} · StudioNet`,
                    size: 17,
                    color: "596579",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            text: record.brief.title,
            heading: HeadingLevel.TITLE,
            spacing: { after: 220 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Validator-backed · ${record.brief.word_count} words · GenLayer StudioNet`,
                color: "596579",
                italics: true,
              }),
            ],
            spacing: { after: 300 },
          }),
          heading("Executive summary"),
          new Paragraph({
            text: record.brief.executive_summary,
            spacing: { after: 150, line: 320 },
          }),
          heading("Shared ground"),
          ...record.brief.shared_ground.map(bulletParagraph),
          heading("Key considerations"),
          ...record.brief.key_considerations.map(bulletParagraph),
          heading("Open questions"),
          ...record.brief.open_questions.map(bulletParagraph),
          heading("Recommended next step"),
          new Paragraph({
            text: record.brief.recommended_next_step,
            spacing: { after: 300, line: 320 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Contract: ", bold: true }),
              new TextRun(proof.contractAddress),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Transaction: ", bold: true }),
              new TextRun(proof.transactionHash),
            ],
          }),
        ],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}

function pdfSafe(value: string): string {
  return value
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("…", "...")
    .replace(/[^\x20-\x7E\n]/gu, "?");
}

function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfSafe(value).split("\n")) {
    const words = paragraph.split(/\s+/u).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function buildPdfExport(
  record: ConsensusBriefRecord,
  proof: Proof,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 54;
  const contentWidth = pageWidth - margin * 2;
  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const nextPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };
  const ensure = (height: number) => {
    if (y - height < margin + 28) nextPage();
  };
  const drawLines = (
    value: string,
    options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10.5;
    const lineHeight = size * 1.45;
    const lines = wrapText(value, font, size, contentWidth);
    ensure(lines.length * lineHeight + 6);
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color: options.color ?? rgb(0.1, 0.13, 0.2),
      });
      y -= lineHeight;
    }
    y -= 5;
  };
  const drawHeading = (value: string) => {
    y -= 9;
    drawLines(value.toUpperCase(), {
      font: bold,
      size: 9,
      color: rgb(0.2, 0.31, 0.64),
    });
  };
  const drawBullets = (items: string[]) => {
    for (const item of items) drawLines(`- ${item}`);
  };

  drawLines("CONSENSUSBRIEF / GENLAYER STUDIONET", {
    font: bold,
    size: 8.5,
    color: rgb(0.2, 0.31, 0.64),
  });
  y -= 12;
  drawLines(record.brief.title, { font: bold, size: 23 });
  drawLines(`${record.brief.word_count} words  |  ${record.id}`, {
    size: 8.5,
    color: rgb(0.35, 0.4, 0.48),
  });
  drawHeading("Executive summary");
  drawLines(record.brief.executive_summary);
  drawHeading("Shared ground");
  drawBullets(record.brief.shared_ground);
  drawHeading("Key considerations");
  drawBullets(record.brief.key_considerations);
  drawHeading("Open questions");
  drawBullets(record.brief.open_questions);
  drawHeading("Recommended next step");
  drawLines(record.brief.recommended_next_step);
  drawHeading("On-chain proof");
  drawLines(`Contract: ${proof.contractAddress}`, { size: 7.5 });
  drawLines(`Transaction: ${proof.transactionHash}`, { size: 7.5 });

  return pdf.save();
}

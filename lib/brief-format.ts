import type { ConsensusBriefRecord } from "./brief";

export function formatBriefText(
  record: ConsensusBriefRecord,
  proof?: { transactionHash: string; contractAddress: string },
): string {
  const sections = [
    record.brief.title,
    "",
    "EXECUTIVE SUMMARY",
    record.brief.executive_summary,
    "",
    "SHARED GROUND",
    ...record.brief.shared_ground.map((item) => `- ${item}`),
    "",
    "KEY CONSIDERATIONS",
    ...record.brief.key_considerations.map((item) => `- ${item}`),
    "",
    "OPEN QUESTIONS",
    ...record.brief.open_questions.map((item) => `- ${item}`),
    "",
    "RECOMMENDED NEXT STEP",
    record.brief.recommended_next_step,
    "",
    `Prepared by ConsensusBrief on GenLayer StudioNet`,
    `Brief ID: ${record.id}`,
    `Creator: ${record.creator}`,
    `Output: ${record.brief.word_count} words`,
  ];
  if (proof) {
    sections.push(
      `Contract: ${proof.contractAddress}`,
      `Transaction: ${proof.transactionHash}`,
    );
  }
  return `${sections.join("\n")}\n`;
}

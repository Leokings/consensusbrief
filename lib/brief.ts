import { z } from "zod";

export const BRIEF_TARGETS = [200, 400, 600, 1000] as const;
export type BriefTarget = (typeof BRIEF_TARGETS)[number];
export const MAX_SOURCE_WORDS = 5_000;
export const MAX_SOURCE_CHARACTERS = 50_000;

export const SOURCE_MINIMUM_BY_TARGET: Record<BriefTarget, number> = {
  200: 50,
  400: 120,
  600: 240,
  1000: 800,
};

export const BRIEF_BOUNDS: Record<BriefTarget, readonly [number, number]> = {
  200: [160, 220],
  400: [320, 440],
  600: [480, 600],
  1000: [800, 1000],
};

export const briefIdPattern = /^[a-z0-9-]{12,48}$/;
export const transactionHashPattern = /^0x[0-9a-fA-F]{64}$/;
export const addressPattern = /^0x[0-9a-fA-F]{40}$/;

export const briefContentSchema = z
  .object({
    title: z.string().min(1).max(200),
    executive_summary: z.string().min(1).max(4_000),
    shared_ground: z.array(z.string().min(1).max(1_200)).min(3).max(6),
    key_considerations: z.array(z.string().min(1).max(1_200)).min(2).max(5),
    open_questions: z.array(z.string().min(1).max(1_200)).min(1).max(4),
    recommended_next_step: z.string().min(1).max(1_500),
    word_count: z.number().int().min(1).max(1000),
  })
  .strict();

export const consensusBriefRecordSchema = z
  .object({
    schema: z.literal("consensusbrief/brief/v1"),
    id: z.string().regex(briefIdPattern),
    creator: z.string().regex(addressPattern),
    created_at: z.string().min(1).max(100),
    request_title: z.string().max(120),
    source_text: z.string().min(1).max(MAX_SOURCE_CHARACTERS),
    source_word_count: z.number().int().min(50).max(MAX_SOURCE_WORDS),
    target_words: z.union([
      z.literal(200),
      z.literal(400),
      z.literal(600),
      z.literal(1000),
    ]),
    minimum_words: z.number().int().min(1).max(1000),
    maximum_words: z.number().int().min(1).max(1000),
    validator_mode: z.literal("SOURCE_GROUNDED_NON_COMPARATIVE"),
    brief: briefContentSchema,
  })
  .strict()
  .superRefine((record, context) => {
    const [minimum, maximum] = BRIEF_BOUNDS[record.target_words];
    if (record.minimum_words !== minimum || record.maximum_words !== maximum) {
      context.addIssue({
        code: "custom",
        message: "The contract returned unexpected word bounds.",
      });
    }
    if (
      record.brief.word_count < minimum ||
      record.brief.word_count > maximum
    ) {
      context.addIssue({
        code: "custom",
        message: "The brief word count is outside its contract bounds.",
      });
    }
  });

export type BriefContent = z.infer<typeof briefContentSchema>;
export type ConsensusBriefRecord = z.infer<typeof consensusBriefRecordSchema>;

export function parseConsensusBriefRecord(value: unknown): ConsensusBriefRecord {
  return consensusBriefRecordSchema.parse(value);
}

export function countWords(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function composeSourceText(sourceText: string, sourceUrl = ""): string {
  const normalizedText = sourceText.trim();
  const normalizedUrl = sourceUrl.trim();
  return normalizedUrl
    ? `Source URL: ${normalizedUrl}\n\n${normalizedText}`
    : normalizedText;
}

export function isBriefTarget(value: number): value is BriefTarget {
  return BRIEF_TARGETS.some((target) => target === value);
}

export function newBriefId(): string {
  return `brief-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

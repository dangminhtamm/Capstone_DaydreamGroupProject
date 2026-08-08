import {
  DEFAULT_TUTURUUU_RESPONSE_MODEL,
  normalizeTuturuuuModelName,
} from "./tuturuuu-client.ts";

export const DEFAULT_GEMINI_ANSWER_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;
export const DEFAULT_GEMINI_CHUNK_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;
export const DEFAULT_GEMINI_VISION_MODEL = "gemini-2.5-flash";

export function getGeminiAnswerModel(): string {
  return normalizeTuturuuuModelName(
    process.env.TUTURUUU_ANSWER_MODEL,
    DEFAULT_GEMINI_ANSWER_MODEL,
  );
}

export function getGeminiChunkModel(): string {
  return normalizeTuturuuuModelName(
    process.env.TUTURUUU_CHUNK_MODEL,
    DEFAULT_GEMINI_CHUNK_MODEL,
  );
}

export function getGeminiVisionModel(): string {
  return process.env.TUTURUUU_VISION_MODEL ?? DEFAULT_GEMINI_VISION_MODEL;
}

export function getGeminiSummaryModel(): string {
  return normalizeTuturuuuModelName(
    process.env.TUTURUUU_SUMMARY_MODEL ??
    process.env.TUTURUUU_ANSWER_MODEL,
    DEFAULT_GEMINI_ANSWER_MODEL,
  );
}

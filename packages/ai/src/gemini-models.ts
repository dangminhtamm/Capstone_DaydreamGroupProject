export const DEFAULT_GEMINI_ANSWER_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_CHUNK_MODEL = "gemini-2.5-flash";
export const DEFAULT_GEMINI_VISION_MODEL = "gemini-2.5-flash";

export function getGeminiAnswerModel(): string {
  return process.env.GEMINI_ANSWER_MODEL ?? DEFAULT_GEMINI_ANSWER_MODEL;
}

export function getGeminiChunkModel(): string {
  return process.env.GEMINI_CHUNK_MODEL ?? DEFAULT_GEMINI_CHUNK_MODEL;
}

export function getGeminiVisionModel(): string {
  return process.env.GEMINI_VISION_MODEL ?? DEFAULT_GEMINI_VISION_MODEL;
}

export function getGeminiSummaryModel(): string {
  return (
    process.env.GEMINI_SUMMARY_MODEL ??
    process.env.GEMINI_ANSWER_MODEL ??
    DEFAULT_GEMINI_ANSWER_MODEL
  );
}

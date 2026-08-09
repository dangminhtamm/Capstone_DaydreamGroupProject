import {
  DEFAULT_TUTURUUU_RESPONSE_MODEL,
  normalizeTuturuuuModelName,
} from "./tuturuuu-client.ts";

export const DEFAULT_GEMINI_ANSWER_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;
export const DEFAULT_GEMINI_CHUNK_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;
export const DEFAULT_GEMINI_VISION_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;

function readModelEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value.replace(/^"|"$/g, "");
  }

  return undefined;
}

function normalizeGeminiGatewayModelName(
  model: string | undefined,
  fallback: string,
): string {
  return normalizeTuturuuuModelName(model, fallback)
    .replace(/^google\//, "")
    .replace(/^models\//, "");
}

export function getGeminiAnswerModel(): string {
  return normalizeTuturuuuModelName(
    readModelEnv("TUTURUUU_ANSWER_MODEL", "GEMINI_ANSWER_MODEL"),
    DEFAULT_GEMINI_ANSWER_MODEL,
  );
}

export function getGeminiChunkModel(): string {
  return normalizeTuturuuuModelName(
    readModelEnv("TUTURUUU_CHUNK_MODEL", "GEMINI_CHUNK_MODEL"),
    DEFAULT_GEMINI_CHUNK_MODEL,
  );
}

export function getGeminiVisionModel(): string {
  return normalizeGeminiGatewayModelName(
    readModelEnv(
      "TUTURUUU_VISION_MODEL",
      "GEMINI_VISION_MODEL",
      "TUTURUUU_ANSWER_MODEL",
      "GEMINI_ANSWER_MODEL",
    ),
    DEFAULT_GEMINI_VISION_MODEL,
  );
}

export function getGeminiSummaryModel(): string {
  return normalizeTuturuuuModelName(
    readModelEnv(
      "TUTURUUU_SUMMARY_MODEL",
      "GEMINI_SUMMARY_MODEL",
      "TUTURUUU_ANSWER_MODEL",
      "GEMINI_ANSWER_MODEL",
    ),
    DEFAULT_GEMINI_ANSWER_MODEL,
  );
}

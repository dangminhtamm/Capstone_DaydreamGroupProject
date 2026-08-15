import {
  DEFAULT_TUTURUUU_RESPONSE_MODEL,
  normalizeTuturuuuModelName,
} from "./tuturuuu-client.ts";

export const DEFAULT_TUTURUUU_ANSWER_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;
export const DEFAULT_TUTURUUU_CHUNK_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;
export const DEFAULT_TUTURUUU_VISION_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;
export const DEFAULT_TUTURUUU_TRANSCRIPTION_MODEL = DEFAULT_TUTURUUU_RESPONSE_MODEL;

function readModelEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value.replace(/^"|"$/g, "") : undefined;
}

export function getTuturuuuAnswerModel(): string {
  return normalizeTuturuuuModelName(
    readModelEnv("TUTURUUU_ANSWER_MODEL"),
    DEFAULT_TUTURUUU_ANSWER_MODEL,
  );
}

export function getTuturuuuChunkModel(): string {
  return normalizeTuturuuuModelName(
    readModelEnv("TUTURUUU_CHUNK_MODEL"),
    DEFAULT_TUTURUUU_CHUNK_MODEL,
  );
}

export function getTuturuuuVisionModel(): string {
  return normalizeTuturuuuModelName(
    readModelEnv("TUTURUUU_VISION_MODEL") ?? readModelEnv("TUTURUUU_ANSWER_MODEL"),
    DEFAULT_TUTURUUU_VISION_MODEL,
  );
}

export function getTuturuuuTranscriptionModel(): string {
  return normalizeTuturuuuModelName(
    readModelEnv("TUTURUUU_TRANSCRIPTION_MODEL") ??
      readModelEnv("TUTURUUU_VISION_MODEL") ??
      readModelEnv("TUTURUUU_ANSWER_MODEL"),
    DEFAULT_TUTURUUU_TRANSCRIPTION_MODEL,
  );
}

export function getTuturuuuSummaryModel(): string {
  return normalizeTuturuuuModelName(
    readModelEnv("TUTURUUU_SUMMARY_MODEL") ?? readModelEnv("TUTURUUU_ANSWER_MODEL"),
    DEFAULT_TUTURUUU_ANSWER_MODEL,
  );
}

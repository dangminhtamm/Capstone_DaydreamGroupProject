import {
  TUTURUUU_EMBEDDING_MODEL,
  type AdvancedEmbeddingProvider,
} from "./embedding.ts";
import type { MemoryChunkMetadata } from "./types.ts";

export interface ExtractedEntityMention {
  entityType: "person" | "project" | "tag" | "goal" | "habit";
  entityValue: string;
}

export const DEFAULT_TEXT_CHUNK_CHARS = 1200;

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function splitTextByBoundary(
  text: string,
  maxChars = DEFAULT_TEXT_CHUNK_CHARS,
): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxChars) {
    const splitAt = findSplitPoint(remaining, maxChars);
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export function coerceDate(value: Date | string | null | undefined, fallback = new Date()): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }

  return fallback;
}

export function normalizeOptionalDateToIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid diary entry date: "${value}"`);
  }
  return date.toISOString();
}

export async function withEmbeddings<T extends { text: string; metadata?: unknown }>(
  chunks: T[],
  embeddingProvider: Pick<AdvancedEmbeddingProvider, "embedDocument">,
): Promise<Array<T & { embedding: number[] }>> {
  if (!chunks.length) return [];

  const concurrency = getEmbeddingConcurrency();
  const results = new Array<T & { embedding: number[] }>(chunks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < chunks.length) {
      const index = nextIndex;
      nextIndex++;
      const chunk = chunks[index];
      const embedding = await embeddingProvider.embedDocument(chunk.text);
      results[index] = {
        ...chunk,
        metadata: annotateEmbeddingMetadata(chunk.metadata, embedding.length) as T["metadata"],
        embedding,
      };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()),
  );
  return results;
}

function annotateEmbeddingMetadata(metadata: unknown, dimension: number): unknown {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }

  return {
    ...metadata,
    embeddingProvider: "tuturuuu",
    embeddingModel: TUTURUUU_EMBEDDING_MODEL,
    embeddingDimension: dimension,
    embeddingUpdatedAt: new Date().toISOString(),
  };
}

export function extractEntityMentionsFromMetadata(
  metadata: MemoryChunkMetadata,
): ExtractedEntityMention[] {
  return [
    ...normalizeEntityList(metadata.people, "person"),
    ...normalizeEntityList(metadata.projects, "project"),
    ...normalizeEntityList(metadata.tags, "tag", true),
    ...normalizeEntityList(metadata.goals, "goal"),
    ...normalizeEntityList(metadata.habits, "habit", true),
  ];
}

function findSplitPoint(text: string, maxChars: number): number {
  const window = text.slice(0, maxChars);
  const sentenceBreak = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );

  if (sentenceBreak >= maxChars * 0.55) {
    return sentenceBreak + 1;
  }

  const wordBreak = window.lastIndexOf(" ");
  return wordBreak >= maxChars * 0.55 ? wordBreak : maxChars;
}

function getEmbeddingConcurrency(): number {
  const configured = Number(process.env.MEMORY_INDEX_EMBED_CONCURRENCY ?? 2);
  if (!Number.isFinite(configured)) return 2;
  return Math.min(6, Math.max(1, Math.floor(configured)));
}

function normalizeEntityList(
  values: string[] | undefined,
  entityType: ExtractedEntityMention["entityType"],
  lowercase = false,
): ExtractedEntityMention[] {
  if (!values?.length) return [];

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => ({
      entityType,
      entityValue: lowercase ? value.toLowerCase() : value,
    }));
}

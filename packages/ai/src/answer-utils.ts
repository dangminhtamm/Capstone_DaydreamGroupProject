import type { MemorySearchHit } from "./retrieval.ts";

export interface MemoryCitation {
  marker: string;
  chunkId: string;
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
  occurredAt: string;
  chunkType: string;
  quote: string;
  similarity: number;
  vectorSimilarity?: number;
  lexicalScore?: number;
  retrievalMode?: string;
  claim?: string;
}

export function buildCitations(chunks: MemorySearchHit[]): MemoryCitation[] {
  return chunks.map((chunk, index) => {
    const metadata = safeMetadata(chunk.metadata);

    return {
      marker: `S${index + 1}`,
      chunkId: chunk.id,
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      sourceTitle: metadata.sourceTitle,
      occurredAt: chunk.occurredAt instanceof Date
        ? chunk.occurredAt.toISOString()
        : new Date(chunk.occurredAt).toISOString(),
      chunkType: chunk.chunkType,
      quote: trimEvidence(chunk.evidence ?? chunk.text),
      similarity: Number(chunk.similarity),
      vectorSimilarity: Number(chunk.vectorSimilarity ?? 0),
      lexicalScore: Number(chunk.lexicalScore ?? 0),
      retrievalMode: chunk.retrievalMode,
    };
  });
}

export function safeMetadata(metadata: unknown): { sourceTitle?: string } {
  if (!metadata || typeof metadata !== "object") return {};
  const value = metadata as Record<string, unknown>;

  return {
    sourceTitle:
      typeof value.sourceTitle === "string" ? value.sourceTitle : undefined,
  };
}

export function trimEvidence(text: string, maxLength = 600): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function classifyRetrievalConfidence(
  topSimilarity: number,
  citationCount: number,
): "high" | "medium" | "low" {
  if (topSimilarity >= 0.8 && citationCount >= 2) return "high";
  if (topSimilarity >= 0.65 && citationCount >= 1) return "medium";
  return "low";
}

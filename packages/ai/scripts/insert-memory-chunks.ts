// packages/db/src/insert-memory-chunks.ts
import type { MemoryChunkMetadata } from "../src/index.ts";
import {
  generateSemanticChunks,
  GeminiEmbeddingProvider,
} from "../src/index.ts";
import {
  prisma,
  insertMemoryChunks,
  type InsertChunkPayload,
} from "@second-brain/db";

async function main(): Promise<void> {
  const sampleUserId = process.env.SAMPLE_USER_ID;
  if (!sampleUserId) {
    throw new Error("Set SAMPLE_USER_ID to an existing users.id value before running this script.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required to generate embeddings.");
  }

  const embeddingProvider = new GeminiEmbeddingProvider(apiKey);
  const sampleDiaryText = ` I met with the mobile team this morning and we agreed to postpone the notification redesign until next sprint. Customer support said users are confused by the onboarding copy, so we should simplify the first two screens. I finished the draft API contract for diary uploads and sent it to the team for review. Tomorrow I need to follow up with Minh about the analytics event naming. I felt calmer today because the plan is finally getting more concrete.`.trim();

  const chunks = await generateSemanticChunks(sampleDiaryText, {
    sourceType: "diary", 
    sourceId: "sample-diary-entry",
    date: new Date().toISOString(),
  });

  const records: InsertChunkPayload[] = [];
  for (const chunk of chunks) {
    records.push(await buildPersistedChunk(chunk, sampleUserId, embeddingProvider));
  }

  await insertMemoryChunks(records);
  console.log(`Inserted/Updated ${records.length} memory chunk(s).`);

  await prisma.$disconnect();
}

async function buildPersistedChunk(
  chunk: { text: string; evidence?: string | null; metadata: MemoryChunkMetadata },
  userId: string,
  embeddingProvider: { embedDocument(text: string): Promise<number[]> }
): Promise<InsertChunkPayload> {
  const embedding = await embeddingProvider.embedDocument(chunk.text);
  
  return {
    userId,
    sourceType: chunk.metadata.sourceType,
    sourceId: chunk.metadata.sourceId,
    chunkIndex: chunk.metadata.chunkIndex,
    chunkType: chunk.metadata.chunkType,
    text: chunk.text,
    evidence: chunk.evidence ?? null,
    occurredAt: new Date(chunk.metadata.date),
    metadata: chunk.metadata,
    embedding,
  };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
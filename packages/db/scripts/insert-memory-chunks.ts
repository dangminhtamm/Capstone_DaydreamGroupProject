import {
  chunkDiaryEntry,
  GeminiEmbeddingProvider,
  type ChunkedMemoryChunk,
} from "../../ai/src/index.ts";
import {
  createPrismaClient,
  insertMemoryChunks,
  type PersistMemoryChunkInput,
} from "../index.ts";

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  
  const sampleUserId = process.env.SAMPLE_USER_ID;
  if (!sampleUserId) {
    throw new Error("Set SAMPLE_USER_ID to an existing users.id value before running this script.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required to generate embeddings.");
  }

  const embeddingProvider = new GeminiEmbeddingProvider(apiKey);

  const sampleDiaryText = `
I met with the mobile team this morning and we agreed to postpone the notification redesign until next sprint.
Customer support said users are confused by the onboarding copy, so we should simplify the first two screens.
I finished the draft API contract for diary uploads and sent it to the team for review.
Tomorrow I need to follow up with Minh about the analytics event naming.
I felt calmer today because the plan is finally getting more concrete.
  `.trim();

  // chunkDiaryEntry is now async after integrating Gemini for classification
  const chunks = await chunkDiaryEntry(sampleDiaryText, {
    sourceType: "diary_entry",
    sourceId: "sample-diary-entry",
    date: new Date().toISOString(),
  });

  const records: PersistMemoryChunkInput[] = [];

  for (const chunk of chunks) {
    records.push(await buildPersistedChunk(chunk, sampleUserId, embeddingProvider));
  }

  await insertMemoryChunks(prisma, records);
  console.log(`Inserted ${records.length} memory chunk(s).`);
  await prisma.$disconnect();
}

async function buildPersistedChunk(
  chunk: ChunkedMemoryChunk,
  userId: string,
  embeddingProvider: { embed(text: string): Promise<number[]> }
): Promise<PersistMemoryChunkInput> {
  const embedding = await embeddingProvider.embed(chunk.text);

  return {
    userId,
    sourceType: chunk.sourceType,
    sourceId: chunk.sourceId,
    chunkType: chunk.chunkType,
    text: chunk.text,
    metadata: chunk.metadata,
    embedding,
  };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
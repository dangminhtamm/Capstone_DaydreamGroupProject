import {
  GeminiEmbeddingProvider,
  indexMemoryFromDiary,
} from "../../ai/src/index.ts";
import {
  createPrismaClient,
  insertMemoryChunks,
  pruneMemoryChunksForSource,
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

  const result = await indexMemoryFromDiary({
    userId: sampleUserId,
    diaryId: "sample-diary-entry",
    rawText: sampleDiaryText,
    entryDate: new Date(),
    sourceTitle: "Sample diary entry",
    embeddingProvider,
    insertChunks: (chunks) =>
      prisma.$transaction(async (tx) => {
        await insertMemoryChunks(tx as any, chunks);
        await pruneMemoryChunksForSource(tx as any, {
          userId: sampleUserId,
          sourceType: "diary",
          sourceId: "sample-diary-entry",
          keepChunkCount: chunks.length,
        });
      }),
  });

  console.log(`Inserted/Updated ${result.chunkCount} memory chunk(s).`);
  console.log(JSON.stringify(result.chunks, null, 2));
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import {
  GeminiEmbeddingProvider,
  indexMemoryFromDiary,
} from "../../ai/src/index.ts";
import {
  createPrismaClient,
  deleteEntityMentionsForSource,
  insertEntityMentions,
  insertMemoryChunks,
  pruneMemoryChunksForSource,
  resolveMemoryChunkIds,
} from "../index.ts";

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  
  const sampleUserId = process.env.SAMPLE_USER_ID;
  if (!sampleUserId) {
    throw new Error("Set SAMPLE_USER_ID to an existing users.id value before running this script.");
  }

  const apiKey = process.env.TUTURUUU_AI_API_KEY;
  if (!apiKey) {
    throw new Error("TUTURUUU_AI_API_KEY is required to generate embeddings.");
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
        await insertMemoryChunks(tx, chunks);
        await pruneMemoryChunksForSource(tx, {
          userId: sampleUserId,
          sourceType: "diary",
          sourceId: "sample-diary-entry",
          keepChunkCount: chunks.length,
        });
      }),
    insertEntityMentions: (mentions) =>
      prisma.$transaction(async (tx) => {
        await deleteEntityMentionsForSource(tx, {
          userId: sampleUserId,
          sourceType: "diary",
          sourceId: "sample-diary-entry",
        });

        if (!mentions.length) return;

        const chunkIdMap = await resolveMemoryChunkIds(tx, {
          userId: sampleUserId,
          sourceType: "diary",
          sourceId: "sample-diary-entry",
        });
        const mentionRows = mentions
          .map((mention) => {
            const chunkId = chunkIdMap.get(mention.chunkIndex);
            if (!chunkId) return null;
            return {
              chunkId,
              entityType: mention.entityType,
              entityValue: mention.entityValue,
            };
          })
          .filter((mention): mention is NonNullable<typeof mention> => mention !== null);

        await insertEntityMentions(tx, mentionRows);
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

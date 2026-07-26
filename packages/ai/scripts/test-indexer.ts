import { indexMemoryFromDiary } from '@second-brain/ai';
import { deleteEntityMentionsForSource, insertEntityMentions, insertMemoryChunks, pruneMemoryChunksForSource, resolveMemoryChunkIds } from '@second-brain/db';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

process.env.DATABASE_URL = process.env.DIRECT_URL;

async function run() {
  // we must instantiate from generated client correctly
  // but to avoid nested imports, just use PrismaClient from db package
  const { PrismaClient: DBPrisma } = await import('@second-brain/db');
  const prisma = new DBPrisma();

  const userId = "c180975e-85c1-4b6e-8cd8-fb45731336c1";
  const diaryId = "test-diary-id-999";
  const rawText = "Nhật kí thường ngày\n\nHôm nay tôi đi học nhóm, sau đó đi ăn với Nhân Khiêm Lâm, về nhà thay đồ và đi ăn omakase. Ngày hôm nay tôi mặc đồ màu đỏ, mọi người thích bộ đồ này. Học nhóm khá mệt nhưng vui !";

  console.log("Indexing...");
  try {
    const indexingResult = await indexMemoryFromDiary({
      userId,
      diaryId,
      rawText,
      entryDate: new Date(),
      sourceTitle: "Nhật kí thường ngày",
      insertChunks: async (chunks) => {
        console.log("Inserting chunks...");
        await prisma.$transaction(async (tx: any) => {
          await insertMemoryChunks(tx, chunks);
          await pruneMemoryChunksForSource(tx, {
            userId,
            sourceType: 'diary',
            sourceId: diaryId,
            keepChunkCount: chunks.length,
          });
        });
        console.log("Inserted chunks");
      },
      insertEntityMentions: async (mentions) => {
        await prisma.$transaction(async (tx: any) => {
          await deleteEntityMentionsForSource(tx, {
            userId,
            sourceType: 'diary',
            sourceId: diaryId,
          });

          if (!mentions.length) return;

          const chunkIdMap = await resolveMemoryChunkIds(tx, {
            userId,
            sourceType: 'diary',
            sourceId: diaryId,
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

          console.log("Inserting mentions...", mentionRows.length);
          await insertEntityMentions(tx, mentionRows);
        });
      },
    });

    console.log("Indexing result:", indexingResult.chunkCount);
    console.log("Entity mention result:", indexingResult.entityMentionCount);
    console.log("Done");

  } catch(e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();

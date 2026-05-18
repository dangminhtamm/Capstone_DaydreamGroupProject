import { PrismaClient } from '@prisma/client';
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
        await insertMemoryChunks(prisma as any, chunks);
        console.log("Inserted chunks");
      }
    });

    console.log("Indexing result:", indexingResult.chunkCount);
    
    // Now test entity mention extraction
    console.log("Resolving chunk IDs...");
    const chunkIdMap = await resolveMemoryChunkIds(prisma as any, {
      userId,
      sourceType: 'diary',
      sourceId: diaryId,
    });

    console.log("Map:", Array.from(chunkIdMap.entries()));
    
    // simulate the rest of the flow
    const mentionPayloads = [];
    for (const chunk of indexingResult.chunks) {
        const chunkId = chunkIdMap.get(chunk.chunkIndex);
        if (!chunkId || !chunk.entityMentions?.length) continue;

        for (const mention of chunk.entityMentions) {
          mentionPayloads.push({
            chunkId,
            entityType: mention.entityType,
            entityValue: mention.entityValue,
          });
        }
    }
    
    if (mentionPayloads.length > 0) {
        console.log("Inserting mentions...", mentionPayloads.length);
        await insertEntityMentions(prisma as any, mentionPayloads);
    }
    console.log("Done");

  } catch(e) {
    console.error("ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();

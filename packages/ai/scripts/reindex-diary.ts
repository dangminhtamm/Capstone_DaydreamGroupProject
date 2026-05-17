import { PrismaClient } from '@prisma/client';
import { indexMemoryFromDiary } from '@second-brain/ai';
import { deleteEntityMentionsForSource, insertEntityMentions, insertMemoryChunks, pruneMemoryChunksForSource, resolveMemoryChunkIds } from '@second-brain/db';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

process.env.DATABASE_URL = process.env.DIRECT_URL;

async function run() {
  const { PrismaClient: DBPrisma } = await import('@second-brain/db');
  const prisma = new DBPrisma();

  try {
    const entry = await prisma.diaryEntry.findUnique({
      where: { id: '8a812dcc-4b2a-4e80-8c4c-c0de68c108fe' },
      include: { user: true }
    });

    if (!entry) {
      console.log("Diary entry not found");
      return;
    }

    console.log("Found entry:", entry.id);
    const title = entry.raw_text.split('\n')[0];

    const indexingResult = await indexMemoryFromDiary({
      userId: entry.user_id,
      diaryId: entry.id,
      rawText: entry.raw_text,
      entryDate: entry.entry_date,
      sourceTitle: title,
      insertChunks: async (chunks) => {
        console.log("Inserting chunks...");
        await insertMemoryChunks(prisma as any, chunks);
        console.log("Inserted chunks successfully.");
      }
    });

    console.log("Indexed chunk count:", indexingResult.chunkCount);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();

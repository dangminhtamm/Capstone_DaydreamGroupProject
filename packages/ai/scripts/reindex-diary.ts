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
        await prisma.$transaction(async (tx: any) => {
          await insertMemoryChunks(tx, chunks);
          await pruneMemoryChunksForSource(tx, {
            userId: entry.user_id,
            sourceType: 'diary',
            sourceId: entry.id,
            keepChunkCount: chunks.length,
          });
        });
        console.log("Inserted chunks successfully.");
      },
      insertEntityMentions: async (mentions) => {
        await prisma.$transaction(async (tx: any) => {
          await deleteEntityMentionsForSource(tx, {
            userId: entry.user_id,
            sourceType: 'diary',
            sourceId: entry.id,
          });

          if (!mentions.length) return;

          const chunkIdMap = await resolveMemoryChunkIds(tx, {
            userId: entry.user_id,
            sourceType: 'diary',
            sourceId: entry.id,
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
        });
      },
    });

    console.log("Indexed chunk count:", indexingResult.chunkCount);
    console.log("Indexed entity mention count:", indexingResult.entityMentionCount);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();

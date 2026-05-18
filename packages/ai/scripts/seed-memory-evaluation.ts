import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./env.ts";
import { resolveEvaluationUserId } from "./eval-user.ts";

loadLocalEnv();

type SeedDiary = {
  id: string;
  entryDate: string;
  title: string;
  content: string;
};

type SeedCalendarEvent = {
  id: string;
  externalId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  htmlLink?: string;
};

type EvaluationDataset = {
  seedDiaries: SeedDiary[];
  seedCalendarEvents: SeedCalendarEvent[];
};

const datasetPath =
  process.env.MEMORY_EVAL_DATASET ??
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../evaluation/memory-evaluation.dataset.json",
  );
const seedDiaryLimit = process.env.MEMORY_SEED_DIARY_LIMIT
  ? Number(process.env.MEMORY_SEED_DIARY_LIMIT)
  : undefined;
const seedDelayMs = Number(process.env.MEMORY_SEED_DELAY_MS ?? 13_000);

if (!process.env.GEMINI_API_KEY) {
  console.error("Set GEMINI_API_KEY before seeding memory evaluation data.");
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL before seeding memory evaluation data.");
  process.exitCode = 1;
} else {
  const [
    db,
    { indexMemoryFromCalendar, indexMemoryFromDiary },
  ] = await Promise.all([
    import("@second-brain/db"),
    import("../src/index.ts"),
  ]);
  const prisma = db.prisma ?? db.createPrismaClient();
  const { deleteMemoryChunksForSource, insertMemoryChunks } = db;
  const userId = await resolveEvaluationUserId(prisma as any, "seed");
  const dataset = JSON.parse(
    readFileSync(datasetPath, "utf8"),
  ) as EvaluationDataset;

  try {
    if (userId) {
      let diaryChunkCount = 0;
      let calendarChunkCount = 0;
      const seedDiaries = Number.isFinite(seedDiaryLimit)
        ? dataset.seedDiaries.slice(0, Math.max(0, seedDiaryLimit ?? 0))
        : dataset.seedDiaries;

      for (const diary of seedDiaries) {
        await prisma.diaryEntry.upsert({
          where: { id: diary.id },
          update: {
            user_id: userId,
            entry_date: new Date(diary.entryDate),
            raw_text: `${diary.title}\n\n${diary.content}`,
            status: "published",
          },
          create: {
            id: diary.id,
            user_id: userId,
            entry_date: new Date(diary.entryDate),
            raw_text: `${diary.title}\n\n${diary.content}`,
            status: "published",
          },
        });

        await deleteMemoryChunksForSource(prisma as any, {
          userId,
          sourceType: "diary",
          sourceId: diary.id,
        });

        const indexed = await indexMemoryFromDiary({
          userId,
          diaryId: diary.id,
          rawText: `${diary.title}\n\n${diary.content}`,
          entryDate: diary.entryDate,
          sourceTitle: diary.title,
          insertChunks: (chunks) => insertMemoryChunks(prisma as any, chunks),
        });

        diaryChunkCount += indexed.chunkCount;

        if (seedDelayMs > 0 && diary !== seedDiaries.at(-1)) {
          await sleep(seedDelayMs);
        }
      }

      const upsertedCalendarEvents = [];
      for (const event of dataset.seedCalendarEvents) {
        const upserted = await prisma.calendarEvent.upsert({
          where: { external_id: event.externalId },
          update: {
            user_id: userId,
            title: event.title,
            description: event.description,
            start_time: new Date(event.startTime),
            end_time: new Date(event.endTime),
            html_link: event.htmlLink ?? null,
          },
          create: {
            id: event.id,
            external_id: event.externalId,
            user_id: userId,
            title: event.title,
            description: event.description,
            start_time: new Date(event.startTime),
            end_time: new Date(event.endTime),
            html_link: event.htmlLink ?? null,
          },
        });

        await deleteMemoryChunksForSource(prisma as any, {
          userId,
          sourceType: "calendar",
          sourceId: upserted.id,
        });

        upsertedCalendarEvents.push({
          eventId: upserted.id,
          externalId: upserted.external_id,
          title: upserted.title,
          description: upserted.description,
          startTime: upserted.start_time,
          endTime: upserted.end_time,
          htmlLink: upserted.html_link,
        });
      }

      const calendarIndexed = await indexMemoryFromCalendar({
        userId,
        events: upsertedCalendarEvents,
        insertChunks: (chunks) => insertMemoryChunks(prisma as any, chunks),
      });
      calendarChunkCount += calendarIndexed.totalChunkCount;

      console.log(
        JSON.stringify(
          {
            seededDiaries: seedDiaries.length,
            seededCalendarEvents: dataset.seedCalendarEvents.length,
            diaryChunkCount,
            calendarChunkCount,
            calendarIndexErrors: calendarIndexed.errors,
            delayMs: seedDelayMs,
            diaryLimit: seedDiaryLimit ?? null,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

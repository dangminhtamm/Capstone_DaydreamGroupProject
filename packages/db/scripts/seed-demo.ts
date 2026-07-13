import { PrismaPg } from "@prisma/adapter-pg";
import PrismaPackage from "@prisma/client";
import { Pool } from "pg";

const { PrismaClient } = PrismaPackage;

type DemoDiary = {
  id: string;
  dayOffset: number;
  title: string;
  content: string;
};

type DemoEvent = {
  id: string;
  externalId: string;
  diaryId: string;
  dayOffset: number;
  title: string;
  description: string;
  startHour: number;
};

const demoPrefix = "[DEMO MVP]";

const diaries: DemoDiary[] = [
  {
    id: "demo-mvp-diary-01",
    dayOffset: -6,
    title: `${demoPrefix} Kickoff and scope`,
    content:
      "We aligned the capstone scope around diary input, memory retrieval, Calendar context, summaries, and attachment ingestion. Tam will focus on retrieval quality, Quan on API stability, Thang on Calendar and worker flows, and Nhan on demo readiness.",
  },
  {
    id: "demo-mvp-diary-02",
    dayOffset: -5,
    title: `${demoPrefix} Mentor feedback`,
    content:
      "The mentor said the product should not look like a basic journal. The key feedback was to show grounded answers with citations, prove Calendar events are linked, and avoid adding Gmail before the core retrieval loop is stable.",
  },
  {
    id: "demo-mvp-diary-03",
    dayOffset: -4,
    title: `${demoPrefix} Attachment ingestion`,
    content:
      "I tested one project brief attachment and wrote down the extraction flow. The important requirement is that private files should be accessed through signed URLs and the worker should extract text before memory indexing.",
  },
  {
    id: "demo-mvp-diary-04",
    dayOffset: -3,
    title: `${demoPrefix} Search evaluation`,
    content:
      "We prepared demo questions about mentor feedback, recent blockers, Calendar meetings, and weekly progress. The answer must cite diary or Calendar sources instead of giving a generic summary.",
  },
  {
    id: "demo-mvp-diary-05",
    dayOffset: -2,
    title: `${demoPrefix} Worker hardening`,
    content:
      "The indexing outbox is now the central path for diary, attachment, Calendar, and summary indexing. The main blocker is making sure the worker is running before the final demo rehearsal.",
  },
  {
    id: "demo-mvp-diary-06",
    dayOffset: -1,
    title: `${demoPrefix} Summary rehearsal`,
    content:
      "Daily and weekly summaries should explain concrete progress, blockers, and next steps. The weekly review should mention Calendar sync, attachment processing, search citations, and the readiness panel.",
  },
  {
    id: "demo-mvp-diary-07",
    dayOffset: 0,
    title: `${demoPrefix} Final MVP checklist`,
    content:
      "The MVP is ready when diary entries, memory chunks, summaries, Calendar events, linked events, and outbox health all pass the demo readiness checks. We should rehearse the flow from diary creation to search answer with citations.",
  },
];

const events: DemoEvent[] = [
  {
    id: "demo-mvp-calendar-01",
    externalId: "demo-mvp-calendar-ext-01",
    diaryId: "demo-mvp-diary-02",
    dayOffset: -5,
    title: "Capstone Mentor Review",
    description: "Discuss feedback about grounded citations and avoiding Gmail scope creep.",
    startHour: 10,
  },
  {
    id: "demo-mvp-calendar-02",
    externalId: "demo-mvp-calendar-ext-02",
    diaryId: "demo-mvp-diary-04",
    dayOffset: -4,
    title: "Search Evaluation Session",
    description: "Review demo questions, expected sources, and retrieval quality.",
    startHour: 14,
  },
  {
    id: "demo-mvp-calendar-03",
    externalId: "demo-mvp-calendar-ext-03",
    diaryId: "demo-mvp-diary-06",
    dayOffset: -1,
    title: "Summary Pipeline Rehearsal",
    description: "Generate daily and weekly summaries for the final MVP demo.",
    startHour: 16,
  },
];

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function createSeedPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return new PrismaClient();
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

function dayAtNoon(anchor: Date, offset: number) {
  const date = new Date(anchor);
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date;
}

function eventDate(anchor: Date, offset: number, hour: number) {
  const start = dayAtNoon(anchor, offset);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hour + 1, 0, 0, 0);
  return { start, end };
}

async function enqueueIndexingJob(
  prisma: any,
  input: {
    userId: string;
    sourceType: "diary" | "calendar" | "summary";
    sourceId: string;
    payload?: Record<string, unknown>;
  },
) {
  await prisma.indexingOutbox.upsert({
    where: {
      job_type_source_type_source_id: {
        job_type: "index_memory",
        source_type: input.sourceType,
        source_id: input.sourceId,
      },
    },
    update: {
      user_id: input.userId,
      status: "pending",
      retry_count: 0,
      error: null,
      payload: input.payload ?? {},
      run_after: new Date(),
      locked_at: null,
      processed_at: null,
    },
    create: {
      user_id: input.userId,
      job_type: "index_memory",
      source_type: input.sourceType,
      source_id: input.sourceId,
      status: "pending",
      payload: input.payload ?? {},
    },
  });
}

async function main() {
  const prisma = createSeedPrismaClient() as any;
  const supabaseId = requiredEnv("DEMO_SUPABASE_USER_ID");
  const email = requiredEnv("DEMO_USER_EMAIL");
  const displayName = process.env.DEMO_DISPLAY_NAME?.trim() || "Demo User";
  const anchor = process.env.DEMO_ANCHOR_DATE
    ? new Date(`${process.env.DEMO_ANCHOR_DATE}T12:00:00`)
    : new Date();

  if (!Number.isFinite(anchor.getTime())) {
    throw new Error("DEMO_ANCHOR_DATE must use YYYY-MM-DD format.");
  }

  try {
    const user = await prisma.user.upsert({
      where: { supabaseId },
      update: { email, display_name: displayName },
      create: { supabaseId, email, display_name: displayName },
      select: { id: true },
    });

    for (const diary of diaries) {
      const entryDate = dayAtNoon(anchor, diary.dayOffset);
      await prisma.diaryEntry.upsert({
        where: { id: diary.id },
        update: {
          user_id: user.id,
          entry_date: entryDate,
          raw_text: `${diary.title}\n\n${diary.content}`,
          status: "published",
        },
        create: {
          id: diary.id,
          user_id: user.id,
          entry_date: entryDate,
          raw_text: `${diary.title}\n\n${diary.content}`,
          status: "published",
        },
      });
      await enqueueIndexingJob(prisma, {
        userId: user.id,
        sourceType: "diary",
        sourceId: diary.id,
        payload: { sourceTitle: diary.title },
      });
    }

    for (const event of events) {
      const { start, end } = eventDate(anchor, event.dayOffset, event.startHour);
      await prisma.calendarEvent.upsert({
        where: {
          user_id_external_id: {
            user_id: user.id,
            external_id: event.externalId,
          },
        },
        update: {
          title: event.title,
          description: event.description,
          start_time: start,
          end_time: end,
          html_link: "https://calendar.google.com/",
        },
        create: {
          id: event.id,
          user_id: user.id,
          external_id: event.externalId,
          title: event.title,
          description: event.description,
          start_time: start,
          end_time: end,
          html_link: "https://calendar.google.com/",
        },
      });
      await prisma.diaryEntry.update({
        where: { id: event.diaryId },
        data: { calendar_events: { set: [{ id: event.id }] } },
      });
      await enqueueIndexingJob(prisma, {
        userId: user.id,
        sourceType: "calendar",
        sourceId: event.id,
        payload: { externalId: event.externalId, sourceTitle: event.title },
      });
    }

    const dailySummary = await prisma.summary.upsert({
      where: {
        user_id_summary_type_period_start_period_end: {
          user_id: user.id,
          summary_type: "daily",
          period_start: dayAtNoon(anchor, 0),
          period_end: new Date(dayAtNoon(anchor, 0).getTime() + 24 * 60 * 60 * 1000 - 1),
        },
      },
      update: {
        content:
          "The team closed the MVP checklist around diary entries, Calendar linking, memory chunks, summaries, and outbox health. The next step is to rehearse search answers with citations.",
      },
      create: {
        user_id: user.id,
        summary_type: "daily",
        period_start: dayAtNoon(anchor, 0),
        period_end: new Date(dayAtNoon(anchor, 0).getTime() + 24 * 60 * 60 * 1000 - 1),
        content:
          "The team closed the MVP checklist around diary entries, Calendar linking, memory chunks, summaries, and outbox health. The next step is to rehearse search answers with citations.",
      },
    });

    await enqueueIndexingJob(prisma, {
      userId: user.id,
      sourceType: "summary",
      sourceId: dailySummary.id,
      payload: { sourceTitle: "Demo daily summary" },
    });

    console.log(
      JSON.stringify(
        {
          userId: user.id,
          diaryEntries: diaries.length,
          calendarEvents: events.length,
          summaries: 1,
          indexingJobsQueued: diaries.length + events.length + 1,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

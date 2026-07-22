import { PrismaPg } from "@prisma/adapter-pg";
import PrismaPackage from "@prisma/client";
import { Pool } from "pg";

const { PrismaClient } = PrismaPackage;

type SeedDiary = {
  id: string;
  dayOffset: number;
  title: string;
  content: string;
  mood: "great" | "good" | "neutral" | "bad";
  tags: string[];
};

const seedPrefix = "[AI MEMORY TEST]";

const diaries: SeedDiary[] = [
  {
    id: "ai-memory-test-diary-01",
    dayOffset: -13,
    title: `${seedPrefix} Capstone kickoff and role decisions`,
    mood: "good",
    tags: ["capstone", "team", "decision"],
    content:
      "Today our team kicked off the Second Brain capstone project. We agreed that Tam owns AI memory retrieval and evaluation, Quan owns backend APIs and attachment ingestion, Thang owns Google Calendar integration, Duc Anh owns frontend demo flow, and Nhan owns deployment, QA, and evaluation reporting. The main decision was to save diary entries first, then let the background worker index memory chunks later so the save action stays fast.",
  },
  {
    id: "ai-memory-test-diary-02",
    dayOffset: -12,
    title: `${seedPrefix} Mentor feedback about trust and citations`,
    mood: "neutral",
    tags: ["feedback", "citation", "mentor"],
    content:
      "Mentor Linh reviewed the early prototype. Her most important feedback was that the app should not feel like a basic journal. She said every AI answer must show clear citations, and the citation cards should be obvious enough that evaluators can trust the answer. She also warned us not to add Gmail before diary, Calendar, attachment, and grounded search are stable.",
  },
  {
    id: "ai-memory-test-diary-03",
    dayOffset: -11,
    title: `${seedPrefix} Attachment ingestion plan`,
    mood: "good",
    tags: ["attachment", "worker", "supabase"],
    content:
      "Quan and I planned the real attachment test. The target flow is upload a PDF, image, DOCX, or text file to Supabase Storage, store an Attachment row, extract text, queue the indexing job, create attachment memory chunks, and make search answers cite the attachment source. My action item is to test one PDF brief and one plain text note before the demo.",
  },
  {
    id: "ai-memory-test-diary-04",
    dayOffset: -10,
    title: `${seedPrefix} Calendar sync and linking test`,
    mood: "neutral",
    tags: ["calendar", "google", "integration"],
    content:
      "Thang tested Google Calendar OAuth with a demo account. The expected flow is connect Calendar, refresh the Google token when needed, sync real events, link diary entries with matching calendar events by date, keyword, and time proximity, then index Calendar events into memory. We prepared a demo event called Capstone Mentor Review scheduled on Friday at 10 AM.",
  },
  {
    id: "ai-memory-test-diary-05",
    dayOffset: -9,
    title: `${seedPrefix} Search quality problems`,
    mood: "bad",
    tags: ["ai-memory", "bug", "retrieval"],
    content:
      "Tam found two search quality problems. First, some answers mentioned the right topic but missed the strongest source. Second, a few generated answers sounded confident even when citation support was weak. We decided to improve local query parsing, boost metadata like people and projects, and fall back to direct evidence when Gemini returns unsupported names or dates.",
  },
  {
    id: "ai-memory-test-diary-06",
    dayOffset: -8,
    title: `${seedPrefix} Mood and tags feature`,
    mood: "great",
    tags: ["mood", "tags", "frontend"],
    content:
      "Duc Anh added a mood selector and tag input to the Diary UI. The mood options are great, good, neutral, and bad. Tags are saved as normalized chips such as capstone, frontend, and blocker. This helps us test questions like what made me stressed this week or which entries were related to Calendar integration.",
  },
  {
    id: "ai-memory-test-diary-07",
    dayOffset: -5,
    title: `${seedPrefix} Weekly risks and blockers`,
    mood: "bad",
    tags: ["risk", "blocker", "demo"],
    content:
      "The main blocker this week is making sure the worker is running before the final rehearsal. If the worker is off, diary entries and attachments are saved but memory chunks are not created yet. Another risk is Gemini quota during live demo. I felt stressed because the worker and quota problems could break the live AI memory search demo. We agreed to prepare fast-path answers and fallback evidence cards so search still works when answer generation is slow or unavailable.",
  },
  {
    id: "ai-memory-test-diary-08",
    dayOffset: -6,
    title: `${seedPrefix} Performance benchmark discussion`,
    mood: "neutral",
    tags: ["latency", "benchmark", "evaluation"],
    content:
      "We discussed the 500 millisecond memory requirement from the review document. We should measure retrieval latency separately from Gemini answer generation. The metrics to report are embedding time, database retrieval time, reranking time, time to first result, answer generation time, and total answer time. We should claim p95 retrieval latency, not average full answer latency.",
  },
  {
    id: "ai-memory-test-diary-09",
    dayOffset: -5,
    title: `${seedPrefix} Evaluation dataset design`,
    mood: "good",
    tags: ["evaluation", "recall", "citation"],
    content:
      "Nhan proposed an AI evaluation sheet with twenty questions. Each row should include the question, expected answer, expected source type, expected source id, actual answer, actual citations, latency, and pass or fail. The key metrics are Recall@5, citation precision, no-answer accuracy, and p95 retrieval latency.",
  },
  {
    id: "ai-memory-test-diary-10",
    dayOffset: -4,
    title: `${seedPrefix} Important decision about Gmail scope`,
    mood: "neutral",
    tags: ["gmail", "scope", "decision"],
    content:
      "We made a scope decision today: Gmail and Google Contacts will stay as future work unless the core demo is already stable. The team should prioritize attachment ingestion, Google Calendar, AI memory evaluation, and deployment docs. This decision came from Linh's earlier feedback about avoiding scope creep.",
  },
  {
    id: "ai-memory-test-diary-11",
    dayOffset: -3,
    title: `${seedPrefix} Frontend demo flow rehearsal`,
    mood: "good",
    tags: ["frontend", "demo", "timeline"],
    content:
      "Duc Anh rehearsed the frontend demo flow. The user starts on Diary, writes an entry with mood and tags, uploads an attachment, opens Settings to sync Calendar, checks demo readiness, then asks Search about mentor feedback and blockers. The strongest UI moment is showing answer confidence and citation cards under the generated answer.",
  },
  {
    id: "ai-memory-test-diary-12",
    dayOffset: -2,
    title: `${seedPrefix} Contact integration future plan`,
    mood: "neutral",
    tags: ["contacts", "future", "google"],
    content:
      "We wrote down a future plan for Google Contacts. The feature would sync contact names, emails, phone numbers, and organizations from Google People API. It would help the memory engine resolve names like Linh, Quan, or Duc Anh. We will not implement this before the current demo unless everything else is complete.",
  },
  {
    id: "ai-memory-test-diary-13",
    dayOffset: -1,
    title: `${seedPrefix} Final AI memory checklist`,
    mood: "good",
    tags: ["ai-memory", "checklist", "qa"],
    content:
      "The final AI memory checklist has six items. First, seed realistic diary data. Second, run the worker to create memory chunks. Third, ask questions about feedback, decisions, blockers, mood, Calendar, and attachments. Fourth, verify citations. Fifth, measure retrieval latency. Sixth, record failed questions and improve retrieval logic only after seeing real failures.",
  },
  {
    id: "ai-memory-test-diary-14",
    dayOffset: 0,
    title: `${seedPrefix} Demo day notes`,
    mood: "great",
    tags: ["demo", "readiness", "summary"],
    content:
      "Today the demo account is ready for AI memory testing. We confirmed that diary entries, mood tags, indexing jobs, and search citations are available. The final focus is to verify whether answers cite the correct evidence, whether retrieval latency is reported separately, and whether unsupported topics are refused instead of invented.",
  },
];

const sampleQuestions = [
  "What feedback did mentor Linh give about citations?",
  "What blockers did we have this week?",
  "Why did we separate retrieval latency from answer generation?",
  "What did we decide about Gmail?",
  "What made me feel stressed this week?",
  "Who owns Google Calendar integration?",
  "What did Duc Anh rehearse in the frontend demo flow?",
  "What was the future plan for Google Contacts?",
  "What did we say about mobile push notification pricing?",
  "Tâm trạng của tôi tuần này như thế nào?",
];

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`${names.join(" or ")} is required.`);
}

function optionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
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

async function resolveTestUser(prisma: any) {
  const configuredSupabaseId = optionalEnv("TEST_SUPABASE_USER_ID", "DEMO_SUPABASE_USER_ID");
  const email = requiredEnv("TEST_USER_EMAIL", "DEMO_USER_EMAIL");
  const displayName = optionalEnv("TEST_DISPLAY_NAME", "DEMO_DISPLAY_NAME") ?? "AI Memory Test User";

  if (configuredSupabaseId) {
    return {
      supabaseId: configuredSupabaseId,
      email,
      displayName,
      resolvedFrom: configuredSupabaseId === process.env.TEST_SUPABASE_USER_ID?.trim()
        ? "TEST_SUPABASE_USER_ID"
        : "DEMO_SUPABASE_USER_ID",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { supabaseId: true, email: true, display_name: true },
  });

  if (existingUser?.supabaseId) {
    return {
      supabaseId: existingUser.supabaseId,
      email: existingUser.email,
      displayName: displayName || existingUser.display_name || "AI Memory Test User",
      resolvedFrom: "existing users.email",
    };
  }

  throw new Error(
    [
      "No app user exists for TEST_USER_EMAIL yet.",
      "Log in once with the test account so /api/auth/sync creates the users row, then rerun this script.",
      "Or set TEST_SUPABASE_USER_ID to the Supabase auth.users.id UUID for that account.",
    ].join(" "),
  );
}

async function enqueueDiaryIndexingJob(
  prisma: any,
  input: {
    userId: string;
    sourceId: string;
    sourceTitle: string;
    mood: string;
    tags: string[];
  },
) {
  await prisma.indexingOutbox.upsert({
    where: {
      job_type_source_type_source_id: {
        job_type: "index_memory",
        source_type: "diary",
        source_id: input.sourceId,
      },
    },
    update: {
      user_id: input.userId,
      status: "pending",
      retry_count: 0,
      error: null,
      payload: {
        sourceTitle: input.sourceTitle,
        mood: input.mood,
        tags: input.tags,
      },
      run_after: new Date(),
      locked_at: null,
      processed_at: null,
    },
    create: {
      user_id: input.userId,
      job_type: "index_memory",
      source_type: "diary",
      source_id: input.sourceId,
      status: "pending",
      payload: {
        sourceTitle: input.sourceTitle,
        mood: input.mood,
        tags: input.tags,
      },
    },
  });
}

async function main() {
  const prisma = createSeedPrismaClient() as any;
  const anchor = process.env.TEST_ANCHOR_DATE
    ? new Date(`${process.env.TEST_ANCHOR_DATE}T12:00:00`)
    : new Date();

  if (!Number.isFinite(anchor.getTime())) {
    throw new Error("TEST_ANCHOR_DATE must use YYYY-MM-DD format.");
  }

  try {
    const { supabaseId, email, displayName, resolvedFrom } = await resolveTestUser(prisma);
    const user = await prisma.user.upsert({
      where: { supabaseId },
      update: { email, display_name: displayName },
      create: { supabaseId, email, display_name: displayName },
      select: { id: true },
    });
    await prisma.searchHistory?.updateMany?.({
      where: {
        user_id: user.id,
        expires_at: { gt: new Date() },
      },
      data: { expires_at: new Date() },
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
          mood: diary.mood,
          tags: diary.tags,
        },
        create: {
          id: diary.id,
          user_id: user.id,
          entry_date: entryDate,
          raw_text: `${diary.title}\n\n${diary.content}`,
          status: "published",
          mood: diary.mood,
          tags: diary.tags,
        },
      });

      await enqueueDiaryIndexingJob(prisma, {
        userId: user.id,
        sourceId: diary.id,
        sourceTitle: diary.title,
        mood: diary.mood,
        tags: diary.tags,
      });
    }

    console.log(
      JSON.stringify(
        {
          userId: user.id,
          supabaseId,
          email,
          resolvedUserFrom: resolvedFrom,
          diaryEntries: diaries.length,
          indexingJobsQueued: diaries.length,
          nextStep: "Run `pnpm demo:drain` or start the worker so diary entries become memory chunks.",
          sampleQuestions,
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

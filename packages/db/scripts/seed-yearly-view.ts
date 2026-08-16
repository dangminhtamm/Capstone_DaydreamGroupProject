import { PrismaPg } from "@prisma/adapter-pg";
import PrismaPackage from "@prisma/client";
import { Pool } from "pg";

const { PrismaClient } = PrismaPackage;
const moods = ["great", "good", "neutral", "bad"] as const;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return new PrismaClient();

  const pool = new Pool({ connectionString });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

function daysInYear(year: number) {
  return new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
}

async function resolveUser(prisma: any) {
  const email = process.env.DEMO_USER_EMAIL?.trim();
  const supabaseId = process.env.DEMO_SUPABASE_USER_ID?.trim();

  if (supabaseId) {
    const existing = await prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true, email: true },
    });
    if (existing) return existing;
    if (!email) {
      throw new Error(
        "DEMO_USER_EMAIL is required when DEMO_SUPABASE_USER_ID does not match an existing app user.",
      );
    }

    return prisma.user.upsert({
      where: { supabaseId },
      update: { email },
      create: {
        supabaseId,
        email,
        display_name: process.env.DEMO_DISPLAY_NAME?.trim() || "Demo User",
      },
      select: { id: true, email: true },
    });
  }

  if (email) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (existing) return existing;
    throw new Error(
      `No app user matches DEMO_USER_EMAIL=${email}. Log in once first, then rerun the seed.`,
    );
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (adminEmails.length > 0) {
    const adminUsers = await prisma.user.findMany({
      where: { email: { in: adminEmails } },
      take: 2,
      select: { id: true, email: true },
    });
    if (adminUsers.length === 1) return adminUsers[0];
  }

  const users = await prisma.user.findMany({
    orderBy: { updated_at: "desc" },
    take: 2,
    select: { id: true, email: true },
  });

  if (users.length === 1) return users[0];
  if (users.length === 0) {
    throw new Error(
      "No app user exists. Log in once first, then rerun pnpm demo:seed:yearly.",
    );
  }

  throw new Error(
    "Multiple app users exist. Set DEMO_USER_EMAIL to choose the account that should receive the yearly demo entries.",
  );
}

async function main() {
  const prisma = createPrismaClient() as any;
  const configuredYear = Number.parseInt(
    process.env.YEARLY_DEMO_YEAR ?? "",
    10,
  );
  const year = Number.isFinite(configuredYear)
    ? configuredYear
    : new Date().getFullYear();

  if (year < 2000 || year > 2100) {
    throw new Error("YEARLY_DEMO_YEAR must be between 2000 and 2100.");
  }

  try {
    const user = await resolveUser(prisma);
    const totalDayNodes = daysInYear(year);
    const prefix = `yearly-demo-${year}-`;
    const entries = Array.from({ length: totalDayNodes }, (_, index) => {
      const entryDate = new Date(Date.UTC(year, 0, index + 1, 12));
      const dayNumber = index + 1;
      const title = `[YEARLY DEMO] Day ${dayNumber} of ${year}`;

      return {
        id: `${prefix}${String(dayNumber).padStart(3, "0")}`,
        user_id: user.id,
        entry_date: entryDate,
        raw_text: `${title}\n\nLoad-test diary entry for ${entryDate.toISOString().slice(0, 10)}. This record proves that the yearly timeline can retrieve and display a complete year without timing out.`,
        status: "published",
        mood: moods[index % moods.length],
        tags: ["yearly-demo", `year-${year}`],
      };
    });

    // Add one extra entry so a normal 365-day year still proves the "365+ entries" requirement.
    entries.push({
      id: `${prefix}extra`,
      user_id: user.id,
      entry_date: new Date(Date.UTC(year, 11, 31, 18)),
      raw_text: `[YEARLY DEMO] Year-end retrospective\n\nExtra entry used to prove that the yearly view supports more than 365 diary entries.`,
      status: "published",
      mood: "great",
      tags: ["yearly-demo", `year-${year}`],
    });

    const result = await prisma.diaryEntry.createMany({
      data: entries,
      skipDuplicates: true,
    });
    const storedEntries = await prisma.diaryEntry.count({
      where: {
        user_id: user.id,
        id: { startsWith: prefix },
      },
    });
    const queryStartedAt = performance.now();
    const yearlyApiRows = await prisma.diaryEntry.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        raw_text: true,
        status: true,
        mood: true,
        tags: true,
        entry_date: true,
        created_at: true,
        updated_at: true,
        attachments: { select: { id: true } },
        calendar_events: { select: { id: true } },
      },
      orderBy: [{ entry_date: "desc" }, { created_at: "desc" }],
      take: 500,
    });
    const yearlyFetchMs =
      Math.round((performance.now() - queryStartedAt) * 100) / 100;

    console.log(
      JSON.stringify(
        {
          user: user.email,
          year,
          dayNodes: totalDayNodes,
          expectedEntries: entries.length,
          insertedNow: result.count,
          storedEntries,
          yearlyApiQueryRows: yearlyApiRows.length,
          yearlyFetchMs,
          acceptanceReady: storedEntries >= 365,
          note: "These load-test records intentionally skip AI indexing to avoid 365+ external embedding calls.",
        },
        null,
        2,
      ),
    );

    if (storedEntries < 365) {
      throw new Error(
        `Only ${storedEntries} yearly demo entries are stored; expected at least 365.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

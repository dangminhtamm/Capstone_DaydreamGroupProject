import { loadLocalEnv } from "./env.ts";

loadLocalEnv();

const question =
  process.argv.slice(2).join(" ").trim() || process.env.MEMORY_QUESTION?.trim();
const userId = process.env.SAMPLE_USER_ID ?? process.env.USER_ID;

if (!question) {
  console.error(
    'Usage: pnpm --filter @second-brain/ai ask:memory "What feedback did I receive last week?"',
  );
  process.exitCode = 1;
} else if (!userId) {
  console.error("Set SAMPLE_USER_ID or USER_ID to the user id you want to query.");
  process.exitCode = 1;
} else if (!process.env.GEMINI_API_KEY) {
  console.error("Set GEMINI_API_KEY before running memory search.");
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL before running memory search.");
  process.exitCode = 1;
} else {
  const [{ prisma }, { answerMemory }] = await Promise.all([
    import("@second-brain/db"),
    import("../src/index.ts"),
  ]);

  try {
    const result = await answerMemory(question, userId, prisma);

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * End-to-end test for answerMemory() (grounded AI memory pipeline).
 *
 * This script wires together:
 *   - answerMemory from @second-brain/ai  (embedding → hybrid retrieval → Gemini answer)
 *   - Prisma from @second-brain/db        (memory_chunks access)
 *
 * Prerequisites:
 *   1. Run insert-memory-chunks.ts first to populate the DB
 *   2. Set the following in packages/db/.env:
 *        DATABASE_URL=postgresql://...
 *        TUTURUUU_AI_API_KEY=...
 *        SAMPLE_USER_ID=<existing users.id>
 *
 * Run with:
 *   node --env-file=.env --experimental-strip-types scripts/test-answer-memory.ts
 */

import { answerMemory } from "../../ai/src/index.ts";
import { createPrismaClient } from "../index.ts";

const DIVIDER = "─".repeat(60);

async function main(): Promise<void> {
  const userId = process.env.SAMPLE_USER_ID;
  if (!userId) throw new Error("Set SAMPLE_USER_ID in your .env file.");

  const apiKey = process.env.TUTURUUU_AI_API_KEY;
  if (!apiKey) throw new Error("Set TUTURUUU_AI_API_KEY in your .env file.");

  const prisma = createPrismaClient();
  const questions = [
    "What did we decide about the sprint?",
    "What do I still need to follow up on?",
    "How was I feeling lately?",
    "Tôi đã hoàn thành những việc gì?",         // Vietnamese: "What have I finished?"
    "Who did I mention in my notes?",
  ];

  for (const question of questions) {
    console.log(`\n${DIVIDER}`);
    console.log(`❓ Question: ${question}`);
    console.log(DIVIDER);

    try {
      const { answer, citations } = await answerMemory(question, userId, prisma, {
        limit: 6,
      });

      console.log(`\n🤖 Answer:\n${answer}`);
      console.log(`\n📚 Sources used (${citations.length}):`);

      for (const [i, src] of citations.entries()) {
        console.log(
          `  [${i + 1}] [${src.chunkType}] (sim=${src.similarity.toFixed(3)}, mode=${src.retrievalMode ?? "unknown"}) ${src.occurredAt}`
        );
        console.log(`       "${src.quote.slice(0, 100)}${src.quote.length > 100 ? "..." : ""}"`);
      }
    } catch (err) {
      console.error(`  ❌ Error processing question:`, err);
    }
  }

  await prisma.$disconnect();
  console.log(`\n${DIVIDER}`);
  console.log("✅ All questions processed.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});

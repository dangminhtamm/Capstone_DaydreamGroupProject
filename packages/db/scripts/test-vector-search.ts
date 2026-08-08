/**
 * Test script for vectorSearch().
 *
 * Prerequisites:
 *   1. Run `insert-memory-chunks.ts` first to populate the DB.
 *   2. Set the following env vars in packages/db/.env:
 *        DATABASE_URL=postgresql://...
 *        TUTURUUU_AI_API_KEY=...
 *        SAMPLE_USER_ID=<an existing users.id>
 *
 * Run with:
 *   node --env-file=.env --experimental-strip-types scripts/test-vector-search.ts
 */

import { GeminiEmbeddingProvider } from "../../ai/src/index.ts";
import { createPrismaClient, vectorSearch } from "../index.ts";

async function main(): Promise<void> {
  const userId = process.env.SAMPLE_USER_ID;
  if (!userId) {
    throw new Error("Set SAMPLE_USER_ID in your .env file.");
  }

  const apiKey = process.env.TUTURUUU_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Set TUTURUUU_AI_API_KEY in your .env file.");
  }

  const prisma = createPrismaClient();
  const embedder = new GeminiEmbeddingProvider(apiKey);

  // --- Test 1: Pure similarity search (no filters) ---
  console.log("\n=== Test 1: Pure similarity search ===");
  const query1 = "What did I decide to do next sprint?";
  console.log(`Query: "${query1}"`);

  const embedding1 = await embedder.embed(query1);
  const results1 = await vectorSearch(prisma, embedding1, {
    userId,
    topK: 5,
  });

  printResults(results1);

  // --- Test 2: Filter by chunkType = "action_item" ---
  console.log("\n=== Test 2: Only action_items ===");
  const query2 = "What do I need to follow up on?";
  console.log(`Query: "${query2}"`);

  const embedding2 = await embedder.embed(query2);
  const results2 = await vectorSearch(prisma, embedding2, {
    userId,
    chunkType: "action_item",
    topK: 5,
  });

  printResults(results2);

  // --- Test 3: Filter by chunkType = "decision" ---
  console.log("\n=== Test 3: Only decisions ===");
  const query3 = "Những quyết định nào đã được đưa ra?";
  console.log(`Query: "${query3}"`);

  const embedding3 = await embedder.embed(query3);
  const results3 = await vectorSearch(prisma, embedding3, {
    userId,
    chunkType: "decision",
    topK: 5,
    minSimilarity: 0.5,
  });

  printResults(results3);

  await prisma.$disconnect();
}

function printResults(results: Awaited<ReturnType<typeof vectorSearch>>): void {
  if (results.length === 0) {
    console.log("  No results found.");
    return;
  }

  for (const [i, r] of results.entries()) {
    console.log(`  [${i + 1}] similarity=${r.similarity.toFixed(4)}  type=${r.chunkType}`);
    console.log(`       "${r.text}"`);
    console.log(`       source=${r.sourceType}/${r.sourceId}  date=${String(r.metadata["date"] ?? "n/a")}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

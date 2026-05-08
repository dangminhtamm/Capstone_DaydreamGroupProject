import {
  DEFAULT_EMBEDDING_DIMENSION,
  GEMINI_EMBEDDING_MODEL,
  createEmbeddingProvider,
} from "../src/index.ts";
import "dotenv/config";

async function run(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for npm run test:embedding:gemini");
  }

  const embedder = createEmbeddingProvider("gemini");
  const text = "Hôm nay mình cảm thấy khá áp lực với deadline.";

  try {
    const embedding = await embedder.embed(text);

    console.log("Embedding provider: gemini");
    console.log("Gemini model:", GEMINI_EMBEDDING_MODEL);
    console.log("Embedding length:", embedding.length);
    console.log("Expected DB vector dimension:", DEFAULT_EMBEDDING_DIMENSION);
    console.log("Sample vector:", embedding.slice(0, 5));
  } catch (error) {
    console.error("Gemini embedding test failed.");
    console.error(
      `Model: ${GEMINI_EMBEDDING_MODEL}. Expected dimension: ${DEFAULT_EMBEDDING_DIMENSION}.`
    );
    throw error;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

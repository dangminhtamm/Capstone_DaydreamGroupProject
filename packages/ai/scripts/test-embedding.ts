import { loadLocalEnv } from "./env.ts";
import {
  DEFAULT_EMBEDDING_DIMENSION,
  GEMINI_EMBEDDING_MODEL,
  createEmbeddingProvider,
} from "../src/embedding.ts";

loadLocalEnv();

async function run(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for embedding test.");
  }

  const embedder = createEmbeddingProvider("gemini");
  const text = "Hôm nay mình cảm thấy khá áp lực với deadline.";

  const embedding = await embedder.embed(text);

  console.log("Embedding provider: gemini");
  console.log("Gemini model:", GEMINI_EMBEDDING_MODEL);
  console.log("Embedding length:", embedding.length);
  console.log("Expected DB vector dimension:", DEFAULT_EMBEDDING_DIMENSION);
  console.log("Sample vector:", embedding.slice(0, 5));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

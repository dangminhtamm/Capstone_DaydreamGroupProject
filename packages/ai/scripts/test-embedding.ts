import { aiGatewayEnvHint, hasAiGatewayKey, loadLocalEnv } from "./env.ts";
import {
  DEFAULT_EMBEDDING_DIMENSION,
  TUTURUUU_EMBEDDING_MODEL,
  createEmbeddingProvider,
} from "../src/embedding.ts";

loadLocalEnv();

async function run(): Promise<void> {
  if (!hasAiGatewayKey()) {
    throw new Error(aiGatewayEnvHint("running the embedding test"));
  }

  const embedder = createEmbeddingProvider("tuturuuu");
  const text = "Hôm nay mình cảm thấy khá áp lực với deadline.";

  const embedding = await embedder.embed(text);

  console.log("Embedding provider: tuturuuu-metered-api");
  console.log("Embedding model:", TUTURUUU_EMBEDDING_MODEL);
  console.log("Embedding length:", embedding.length);
  console.log("Expected DB vector dimension:", DEFAULT_EMBEDDING_DIMENSION);
  console.log("Sample vector:", embedding.slice(0, 5));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

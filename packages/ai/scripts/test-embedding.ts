import { createEmbeddingProvider } from "../src/index.ts";
import "dotenv/config";

async function run() {
  const providerName = "mock";
  const embedder = createEmbeddingProvider(providerName);

  const text = "Hôm nay mình cảm thấy khá áp lực với deadline.";

  const embedding = await embedder.embed(text);

  console.log("Embedding provider:", providerName);
  console.log("Embedding length:", embedding.length);
  console.log("Sample vector:", embedding.slice(0, 5));
}

run().catch(console.error);

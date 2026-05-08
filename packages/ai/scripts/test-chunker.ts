import { loadLocalEnv } from "./env.ts";
import { generateSemanticChunks } from "../src/chunker.ts";

loadLocalEnv();

const sampleDiaryText = `Tối qua đi nhậu với team, chốt lại là sang tuần phải đẩy nhanh tiến độ làm UI. Lâu rồi mới thấy thoải mái nhẹ đầu như vậy.`.trim();

async function runTest() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ ERROR: Please configure the GEMINI_API_KEY environment variable before running the test.");
    process.exitCode = 1;
    return;
  }

  try {
    console.log("🤖 Running Semantic Chunker test with Gemini...");
    console.log("📝 Input text:");
    console.log(`"${sampleDiaryText}"\n`);
    console.log("Analyzing and chunking...\n");
    
    const chunks = await generateSemanticChunks(sampleDiaryText, {
      sourceType: "diary", // Matches the type 'diary' | 'calendar' | 'gmail'
      sourceId: "demo-diary-entry",
      date: new Date().toISOString(),
    });

    console.log("✅ Result (Semantic Chunks):");
    console.log(JSON.stringify(chunks, null, 2));
  } catch (error) {
    console.error("❌ Error during test execution:", error);
    process.exitCode = 1;
  }
}

runTest();

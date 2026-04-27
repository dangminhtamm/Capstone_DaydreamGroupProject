import { chunkDiaryEntry } from "../src/index.ts";

process.env.AI_CLASSIFIER_MODE = "local";

const sampleDiaryText = `Tối qua đi nhậu với team, chốt lại là sang tuần phải đẩy nhanh tiến độ làm UI. Lâu rồi mới thấy thoải mái nhẹ đầu như vậy.`.trim();

async function runTest() {
  try {
    console.log("Running chunker test with local fallback enabled if Gemini is unavailable...");
    
    const chunks = await chunkDiaryEntry(sampleDiaryText, {
      sourceType: "diary_entry",
      sourceId: "demo-diary-entry",
      date: new Date().toISOString(),
    });

    console.log("Kết quả:");
    console.log(JSON.stringify(chunks, null, 2));
  } catch (error) {
    console.error("Lỗi rồi:", error);
  }
}

// Gọi hàm chạy test
runTest();

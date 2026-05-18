import { generateSemanticChunks } from '../src/chunker.ts';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function run() {
  const text = `Nhật kí thường ngày\n\nHôm nay tôi đi học nhóm, sau đó đi ăn với Nhân Khiêm Lâm, về nhà thay đồ và đi ăn omakase. Ngày hôm nay tôi mặc đồ màu đỏ, mọi người thích bộ đồ này. Học nhóm khá mệt nhưng vui !`;

  console.log("Calling chunker...");
  try {
    const chunks = await generateSemanticChunks(text, {
      date: new Date().toISOString(),
      sourceType: "diary",
      sourceId: "test",
      sourceTitle: "Nhật kí thường ngày"
    });
    console.log("RESULT:", JSON.stringify(chunks, null, 2));
  } catch(e) {
    console.error("ERROR:", e);
  }
}

run();

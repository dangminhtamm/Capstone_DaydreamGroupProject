import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

async function run() {
  try {
    const res = await pool.query('SELECT id, raw_text FROM diary_entries ORDER BY created_at DESC LIMIT 5;');
    console.log("--- LATEST DIARY ENTRIES ---");
    console.log(res.rows);

    const res2 = await pool.query('SELECT id, text, chunk_type, embedding IS NOT NULL as has_embedding, metadata FROM memory_chunks ORDER BY created_at DESC LIMIT 5;');
    console.log("\n--- LATEST MEMORY CHUNKS ---");
    console.log(res2.rows);

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();

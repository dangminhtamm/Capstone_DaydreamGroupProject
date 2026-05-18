import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });

async function run() {
  try {
    const res = await pool.query(`SELECT id, text, chunk_type, metadata FROM memory_chunks WHERE source_id = '8a812dcc-4b2a-4e80-8c4c-c0de68c108fe';`);
    console.log("--- CHUNKS FOR OMAKASE DIARY ---");
    console.log(res.rows);

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();

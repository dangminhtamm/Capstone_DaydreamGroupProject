// Script to run raw SQL migration against the database
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL is required in environment variables.');
  process.exit(1);
}

const migrationFile = path.resolve(
  __dirname,
  '../prisma/migrations/202605160001_optimize_hnsw_and_entity_mention_indexes/migration.sql',
);

const sql = fs.readFileSync(migrationFile, 'utf-8');

console.log('Connecting to database...');
const pool = new pg.Pool({ connectionString: directUrl });

try {
  await pool.query(sql);
  console.log('✅ Migration applied successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  await pool.end();
}

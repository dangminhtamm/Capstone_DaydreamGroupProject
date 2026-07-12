import { existsSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '../api/.env'),
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../api/.env'),
];

for (const path of [...new Set(candidates)]) {
  if (existsSync(path)) {
    dotenv.config({ path, override: false });
  }
}

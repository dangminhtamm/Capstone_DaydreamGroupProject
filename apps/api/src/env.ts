import { existsSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../.env'),
];

for (const path of [...new Set(candidates)]) {
  if (existsSync(path)) {
    dotenv.config({ path, override: false });
  }
}

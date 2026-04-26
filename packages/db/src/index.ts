// Old
export function getDbClient() {
  return {
    status: "not-configured",
  };
}
// New
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Create a native Postgres connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// 2. Wrap the pool in the Prisma adapter
const adapter = new PrismaPg(pool);

// 3. Pass the adapter into the constructor (Required for Prisma v7)
export const prisma = new PrismaClient({ adapter });

// Export all types for your NestJS and Next.js apps
export * from '@prisma/client';

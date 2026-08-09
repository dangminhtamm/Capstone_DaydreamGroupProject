import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const transactionMaxWaitMs = readPositiveInt('PRISMA_TRANSACTION_MAX_WAIT_MS', 10_000);
const transactionTimeoutMs = readPositiveInt('PRISMA_TRANSACTION_TIMEOUT_MS', 30_000);

export const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: transactionMaxWaitMs,
    timeout: transactionTimeoutMs,
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

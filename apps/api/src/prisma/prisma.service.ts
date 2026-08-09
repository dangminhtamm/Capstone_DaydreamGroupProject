import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const transactionMaxWaitMs = readPositiveInt('PRISMA_TRANSACTION_MAX_WAIT_MS', 10_000);
const transactionTimeoutMs = readPositiveInt('PRISMA_TRANSACTION_TIMEOUT_MS', 30_000);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      adapter,
      transactionOptions: {
        maxWait: transactionMaxWaitMs,
        timeout: transactionTimeoutMs,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}

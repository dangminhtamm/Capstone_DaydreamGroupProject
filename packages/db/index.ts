import { createRequire } from "node:module";

import type { Prisma, PrismaClient as PrismaClientPackage } from "@prisma/client";

import type { ChunkType, MemoryChunk } from "../ai/src/index.ts";

const require = createRequire(import.meta.url);

type PrismaClientLike = Pick<PrismaClientPackage, "$disconnect" | "$executeRawUnsafe">;

interface PrismaClientConstructor {
  new (): PrismaClientLike;
}

interface PrismaRuntimeModule {
  PrismaClient: PrismaClientConstructor;
}

export interface PersistMemoryChunkInput
  extends Omit<MemoryChunk, "id" | "createdAt" | "updatedAt"> {
  userId: string;
  chunkType: ChunkType;
  metadata: Prisma.JsonValue;
  embedding?: number[] | null;
}

function loadPrismaModule(): PrismaRuntimeModule {
  try {
    return require("./prisma/generated/client") as PrismaRuntimeModule;
  } catch {
    try {
      return require("@prisma/client") as PrismaRuntimeModule;
    } catch (error) {
      const packageError = error as Error;

      packageError.message =
        "Unable to load Prisma client. Run `pnpm --dir packages/db prisma:generate` first.\n" +
        packageError.message;
      throw packageError;
    }
  }
}

const prismaModule = loadPrismaModule();

export const PrismaClient = prismaModule.PrismaClient;

export function createPrismaClient(): PrismaClientLike {
  return new PrismaClient();
}

export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length === 0) {
    throw new Error("Embedding must be a non-empty number array.");
  }

  const normalized = embedding.map((value) => {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding values must be finite numbers.");
    }

    return Number(value.toFixed(6));
  });

  return `[${normalized.join(",")}]`;
}

export async function insertMemoryChunk(
  prisma: PrismaClientLike,
  input: PersistMemoryChunkInput
): Promise<void> {
  const metadataJson = JSON.stringify(input.metadata);
  const embeddingLiteral = input.embedding == null ? null : toVectorLiteral(input.embedding);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "memory_chunks" (
        "user_id",
        "source_type",
        "source_id",
        "chunk_type",
        "text",
        "metadata",
        "embedding"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        CASE
          WHEN $7::text IS NULL THEN NULL
          ELSE $7::vector
        END
      )
    `,
    input.userId,
    input.sourceType,
    input.sourceId,
    input.chunkType,
    input.text,
    metadataJson,
    embeddingLiteral
  );
}

export async function insertMemoryChunks(
  prisma: PrismaClientLike,
  inputs: PersistMemoryChunkInput[]
): Promise<void> {
  for (const input of inputs) {
    await insertMemoryChunk(prisma, input);
  }
}

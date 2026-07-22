import { prisma } from './client';
import { toVectorLiteral } from './vector';

export interface InsertChunkPayload {
  userId: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  chunkType: string;
  text: string;
  evidence: string | null;
  metadata: any;
  occurredAt: Date;
  embedding: number[];
}

type PrismaLike = {
  $executeRaw: (...args: any[]) => Promise<unknown>;
  $transaction?: (queries: Promise<unknown>[]) => Promise<unknown>;
};

export async function insertMemoryChunks(
  chunks: InsertChunkPayload[],
): Promise<void>;
export async function insertMemoryChunks(
  client: PrismaLike,
  chunks: InsertChunkPayload[],
): Promise<void>;
export async function insertMemoryChunks(
  clientOrChunks: PrismaLike | InsertChunkPayload[],
  maybeChunks?: InsertChunkPayload[],
) {
  const client = Array.isArray(clientOrChunks) ? prisma : clientOrChunks;
  const chunks = maybeChunks ?? (clientOrChunks as InsertChunkPayload[]);

  if (!chunks || chunks.length === 0) return;

  const queries = chunks.map((chunk) => {
      const vectorString = toVectorLiteral(chunk.embedding);
      const metadataJson = JSON.stringify(chunk.metadata ?? {});

      return client.$executeRaw`
        INSERT INTO memory_chunks (
          user_id, 
          source_type, 
          source_id, 
          chunk_index,
          chunk_type, 
          text, 
          evidence,
          metadata, 
          occurred_at,
          embedding,
          updated_at
        )
        VALUES (
          ${chunk.userId}::uuid,
          ${chunk.sourceType},
          ${chunk.sourceId},
          ${chunk.chunkIndex},
          ${chunk.chunkType},
          ${chunk.text},
          ${chunk.evidence},
          ${metadataJson}::jsonb,
          ${chunk.occurredAt},
          ${vectorString}::vector,
          now()
        )
        ON CONFLICT (user_id, source_type, source_id, chunk_index)
        DO UPDATE SET
          chunk_type = EXCLUDED.chunk_type,
          text = EXCLUDED.text,
          evidence = EXCLUDED.evidence,
          metadata = EXCLUDED.metadata,
          occurred_at = EXCLUDED.occurred_at,
          embedding = EXCLUDED.embedding,
          updated_at = now();
      `;
  });

  if (client.$transaction) {
    await client.$transaction(queries);
    return;
  }

  await Promise.all(queries);
}

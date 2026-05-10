import { prisma } from './client';
import { toVectorLiteral } from '../index';

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

export async function insertMemoryChunks(chunks: InsertChunkPayload[]) {
  if (!chunks || chunks.length === 0) return;

  return await prisma.$transaction(
    chunks.map((chunk) => {
      const vectorString = toVectorLiteral(chunk.embedding);
      const metadataJson = JSON.stringify(chunk.metadata ?? {});

      return prisma.$executeRaw`
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
    })
  );
}

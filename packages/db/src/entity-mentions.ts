import { prisma } from './client';

export interface EntityMentionPayload {
  chunkId: string;
  entityType: string; // 'person', 'project', 'tag'
  entityValue: string;
}

/**
 * Insert entity mentions extracted from a memory chunk.
 * Uses ON CONFLICT to avoid duplicates if the same entity is extracted again.
 */
export async function insertEntityMentions(
  mentions: EntityMentionPayload[],
): Promise<void> {
  if (!mentions.length) return;

  // Deduplicate within the batch (same chunk + type + value)
  const seen = new Set<string>();
  const unique = mentions.filter((m) => {
    const key = `${m.chunkId}:${m.entityType}:${m.entityValue}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await prisma.$transaction(
    unique.map((m) =>
      prisma.$executeRaw`
        INSERT INTO entity_mentions (id, chunk_id, entity_type, entity_value)
        VALUES (gen_random_uuid(), ${m.chunkId}, ${m.entityType}, ${m.entityValue})
        ON CONFLICT DO NOTHING;
      `,
    ),
  );
}

/**
 * Delete all entity mentions for chunks belonging to a specific source.
 * Called before re-indexing to avoid stale entities.
 */
export async function deleteEntityMentionsForSource(
  userId: string,
  sourceType: string,
  sourceId: string,
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM entity_mentions
    WHERE chunk_id IN (
      SELECT id FROM memory_chunks
      WHERE user_id = ${userId}::uuid
        AND source_type = ${sourceType}
        AND source_id = ${sourceId}
    );
  `;
}

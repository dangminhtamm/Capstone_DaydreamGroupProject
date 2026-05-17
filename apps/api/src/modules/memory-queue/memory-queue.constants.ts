// apps/api/src/modules/memory-queue/memory-queue.constants.ts
//
// Central place for queue names and job types, so producers and consumers
// always agree on the same identifiers.

/** Queue name for all AI memory indexing jobs. */
export const MEMORY_INDEX_QUEUE = 'memory-index';

/** Job types dispatched to the memory-index queue. */
export enum MemoryJobType {
  /** Index or re-index a single diary entry */
  INDEX_DIARY = 'index-diary',
  /** Index calendar events (batch) */
  INDEX_CALENDAR = 'index-calendar',
  /** Re-index all diary entries for a user (admin/recovery) */
  REINDEX_ALL_DIARY = 'reindex-all-diary',
}

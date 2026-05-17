import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { indexMemoryFromDiary } from '@second-brain/ai';
import {
  deleteMemoryChunksForSource,
  deleteEntityMentionsForSource,
  insertEntityMentions,
  insertMemoryChunks,
  pruneMemoryChunksForSource,
  resolveMemoryChunkIds,
} from '@second-brain/db';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryQueueProducer } from '../memory-queue/memory-queue.producer';
import { CreateDiaryDto } from './dto/create-diary.dto';

@Injectable()
export class DiaryService {
  constructor(
    private prisma: PrismaService,
    /** Optional — if Redis is unavailable, queue won't be injected and we fall back to inline. */
    @Optional() private readonly memoryQueue?: MemoryQueueProducer,
  ) {}

  async create(userId: string, dto: CreateDiaryDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const entry = await this.prisma.diaryEntry.create({
      data: {
        raw_text: `${dto.title}\n\n${dto.content}`,
        user_id: user.id,
        status: 'published',
      },
    });

    // Dispatch to background queue if available, otherwise index inline
    const indexingResult = await this.dispatchOrIndexDiary(
      user.id,
      entry,
      dto.title,
    );

    return {
      ...this.toClientEntry(entry),
      memoryIndexed: indexingResult.indexed,
      memoryChunkCount: indexingResult.chunkCount,
      memoryQueued: indexingResult.queued,
    };
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) return [];

    const entries = await this.prisma.diaryEntry.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });

    return entries.map((entry) => this.toClientEntry(entry));
  }

  async findOne(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('Diary entry not found');

    const entry = await this.prisma.diaryEntry.findFirst({
      where: { id, user_id: user.id },
    });
    if (!entry) throw new NotFoundException('Diary entry not found');
    return this.toClientEntry(entry);
  }

  async update(userId: string, id: string, dto: Partial<CreateDiaryDto>) {
    const { user, entry: existingEntry } = await this.findOwnedEntry(
      userId,
      id,
    );
    const existingClientEntry = this.toClientEntry(existingEntry);
    const title = dto.title ?? existingClientEntry.title;
    const content = dto.content ?? existingClientEntry.content;
    const rawText = this.buildRawText(title, content);

    const entry = await this.prisma.diaryEntry.update({
      where: { id },
      data: {
        raw_text: rawText,
      },
    });

    // Dispatch to background queue if available, otherwise index inline
    const indexingResult = await this.dispatchOrIndexDiary(
      user.id,
      entry,
      title,
    );

    return {
      ...this.toClientEntry(entry),
      memoryIndexed: indexingResult.indexed,
      memoryChunkCount: indexingResult.chunkCount,
      memoryQueued: indexingResult.queued,
    };
  }

  async remove(userId: string, id: string) {
    const { user } = await this.findOwnedEntry(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await deleteMemoryChunksForSource(tx as any, {
        userId: user.id,
        sourceType: 'diary',
        sourceId: id,
      });

      return tx.diaryEntry.delete({ where: { id } });
    });
  }

  // -----------------------------------------------------------------------
  // Dispatch: Queue vs Inline
  // -----------------------------------------------------------------------

  /**
   * Try to enqueue the indexing job to BullMQ.
   * If the queue is unavailable (no Redis), fall back to synchronous inline indexing.
   */
  private async dispatchOrIndexDiary(
    userId: string,
    entry: { id: string; raw_text: string; entry_date: Date },
    sourceTitle: string,
  ): Promise<{ indexed: boolean; chunkCount: number; queued: boolean }> {
    // Try queue-based approach first
    if (this.memoryQueue) {
      try {
        await this.memoryQueue.enqueueDiaryIndex({
          userId,
          diaryId: entry.id,
          rawText: entry.raw_text,
          entryDate: entry.entry_date.toISOString(),
          sourceTitle,
        });

        console.log(`[DiaryService] Diary ${entry.id} enqueued for background indexing`);
        return { indexed: false, chunkCount: 0, queued: true };
      } catch (queueError) {
        console.warn(
          '[DiaryService] Failed to enqueue job, falling back to inline:',
          queueError instanceof Error ? queueError.message : queueError,
        );
        // Fall through to inline indexing
      }
    }

    // Inline fallback (original behavior)
    try {
      const result = await this.indexDiaryEntryInline(userId, entry, sourceTitle);
      return { indexed: true, chunkCount: result.chunkCount, queued: false };
    } catch (error) {
      console.error('Failed to index diary entry into memory chunks:', error);
      throw new InternalServerErrorException(
        'Diary entry was saved, but memory indexing failed.',
      );
    }
  }

  // -----------------------------------------------------------------------
  // Inline indexing (fallback when Redis is unavailable)
  // -----------------------------------------------------------------------

  private async indexDiaryEntryInline(
    userId: string,
    entry: { id: string; raw_text: string; entry_date: Date },
    sourceTitle: string,
  ) {
    const indexingResult = await indexMemoryFromDiary({
      userId,
      diaryId: entry.id,
      rawText: entry.raw_text,
      entryDate: entry.entry_date,
      sourceTitle,
      insertChunks: (chunks) =>
        this.prisma.$transaction(async (tx) => {
          await insertMemoryChunks(tx as any, chunks);
          await pruneMemoryChunksForSource(tx as any, {
            userId,
            sourceType: 'diary',
            sourceId: entry.id,
            keepChunkCount: chunks.length,
          });
        }),
    });

    if (indexingResult.chunkCount === 0) {
      await deleteMemoryChunksForSource(this.prisma as any, {
        userId,
        sourceType: 'diary',
        sourceId: entry.id,
      });
      await deleteEntityMentionsForSource(this.prisma as any, {
        userId,
        sourceType: 'diary',
        sourceId: entry.id,
      });
    } else {
      await this.persistEntityMentions(userId, entry.id, indexingResult);
    }

    return indexingResult;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async findOwnedEntry(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('Diary entry not found');

    const entry = await this.prisma.diaryEntry.findFirst({
      where: { id, user_id: user.id },
    });

    if (!entry) throw new NotFoundException('Diary entry not found');

    return { user, entry };
  }

  private async persistEntityMentions(
    userId: string,
    diaryId: string,
    indexingResult: { chunks: Array<{ chunkIndex: number; entityMentions?: Array<{ entityType: string; entityValue: string }> }> },
  ) {
    try {
      await deleteEntityMentionsForSource(this.prisma as any, {
        userId,
        sourceType: 'diary',
        sourceId: diaryId,
      });

      const chunkIdMap = await resolveMemoryChunkIds(this.prisma as any, {
        userId,
        sourceType: 'diary',
        sourceId: diaryId,
      });

      const mentionPayloads: Array<{ chunkId: string; entityType: string; entityValue: string }> = [];

      for (const chunk of indexingResult.chunks) {
        const chunkId = chunkIdMap.get(chunk.chunkIndex);
        if (!chunkId || !chunk.entityMentions?.length) continue;

        for (const mention of chunk.entityMentions) {
          mentionPayloads.push({
            chunkId,
            entityType: mention.entityType,
            entityValue: mention.entityValue,
          });
        }
      }

      if (mentionPayloads.length > 0) {
        await insertEntityMentions(this.prisma as any, mentionPayloads);
        console.log(
          `[DiaryService] Persisted ${mentionPayloads.length} entity mentions for diary ${diaryId}`,
        );
      }
    } catch (error) {
      console.error('Failed to persist entity mentions (non-fatal):', error);
    }
  }

  private buildRawText(title: string, content: string) {
    return `${title.trim()}\n\n${content.trim()}`;
  }

  private toClientEntry(entry: { id: string; raw_text: string; status: string; created_at: Date; updated_at: Date }) {
    const [title, ...contentParts] = entry.raw_text.split('\n\n');

    return {
      id: entry.id,
      title: title || 'Untitled',
      content: contentParts.join('\n\n') || entry.raw_text,
      status: entry.status,
      createdAt: entry.created_at.toISOString(),
      updatedAt: entry.updated_at.toISOString(),
    };
  }
}

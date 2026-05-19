import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { indexMemoryFromDiary } from '@second-brain/ai';
import {
  deleteMemoryChunksForSource,
  insertMemoryChunks,
  pruneMemoryChunksForSource,
} from '@second-brain/db';
import { PrismaService } from '../../prisma/prisma.service'; // Adjust path based on your setup
import { CreateDiaryDto } from './dto/create-diary.dto';

@Injectable()
export class DiaryService {
  constructor(private prisma: PrismaService) {}

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

    try {
      const indexingResult = await this.indexDiaryEntry(
        user.id,
        entry,
        dto.title,
      );

      return {
        ...this.toClientEntry(entry),
        memoryIndexed: true,
        memoryChunkCount: indexingResult.chunkCount,
      };
    } catch (error) {
      console.error('Failed to index diary entry into memory chunks:', error);
      throw new InternalServerErrorException(
        'Diary entry was saved, but memory indexing failed.',
      );
    }
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

    try {
      const indexingResult = await this.indexDiaryEntry(user.id, entry, title);

      return {
        ...this.toClientEntry(entry),
        memoryIndexed: true,
        memoryChunkCount: indexingResult.chunkCount,
      };
    } catch (error) {
      await this.prisma.diaryEntry
        .update({
          where: { id },
          data: { raw_text: existingEntry.raw_text },
        })
        .catch((rollbackError) => {
          console.error('Failed to rollback diary update:', rollbackError);
        });

      console.error('Failed to re-index updated diary entry:', error);
      throw new InternalServerErrorException(
        'Diary update was rolled back because memory re-indexing failed.',
      );
    }
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

  private async indexDiaryEntry(
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
    }

    return indexingResult;
  }

  private buildRawText(title: string, content: string) {
    return `${title.trim()}\n\n${content.trim()}`;
  }

  private toClientEntry(entry: { id: string; raw_text: string; status: string; created_at: Date; updated_at: Date }) {
    const trimmedText = entry.raw_text.trim();
    
    let title = 'Untitled';
    let content = '';

    // First try splitting on double newline (\n\n) as it is the primary format
    const doubleNewLineIndex = trimmedText.indexOf('\n\n');
    if (doubleNewLineIndex !== -1) {
      title = trimmedText.slice(0, doubleNewLineIndex).trim();
      content = trimmedText.slice(doubleNewLineIndex + 2).trim();
    } else {
      // Fallback: try splitting on the first single newline
      const singleNewLineIndex = trimmedText.indexOf('\n');
      if (singleNewLineIndex !== -1) {
        title = trimmedText.slice(0, singleNewLineIndex).trim();
        content = trimmedText.slice(singleNewLineIndex + 1).trim();
      } else {
        // If there are no newlines at all, use the whole text as title (up to a reasonable limit) and empty content
        if (trimmedText.length <= 60) {
          title = trimmedText;
          content = '';
        } else {
          // If the text is long, truncate the title and set the whole text as content
          title = trimmedText.slice(0, 57) + '...';
          content = trimmedText;
        }
      }
    }

    return {
      id: entry.id,
      title: title || 'Untitled',
      content: content || trimmedText || 'No content',
      status: entry.status,
      createdAt: entry.created_at.toISOString(),
      updatedAt: entry.updated_at.toISOString(),
    };
  }
}

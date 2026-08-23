import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { generateAiText, getTuturuuuAnswerModel } from '@second-brain/ai';
import { deleteMemoryChunksForSource } from '@second-brain/db';
import { isAttachmentExtractionFallback } from '@second-brain/shared';
import { invalidateUserSearchCache } from '../../common/cache/search-answer-cache';
import { PrismaService } from '../../prisma/prisma.service'; // Adjust path based on your setup
import { StorageService } from '../../storage/storage.service';
import { CreateDiaryDto, DIARY_MOODS } from './dto/create-diary.dto';

type DiaryMood = (typeof DIARY_MOODS)[number];

@Injectable()
export class DiaryService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async create(userId: string, dto: CreateDiaryDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const entry = await this.prisma.$transaction(async (tx) => {
      const tags = this.normalizeTags(dto.tags);
      const mood = this.normalizeMood(dto.mood);
      const created = await tx.diaryEntry.create({
        data: {
          raw_text: `${dto.title}\n\n${dto.content}`,
          user_id: user.id,
          status: 'published',
          ...(mood ? { mood } : {}),
          tags,
          ...(dto.entryDate ? { entry_date: new Date(dto.entryDate) } : {}),
        },
      });

      await this.enqueueIndexingJob(tx, {
        userId: user.id,
        sourceType: 'diary',
        sourceId: created.id,
        payload: { sourceTitle: dto.title, mood, tags },
      });

      return created;
    });

    return {
      ...(await this.toClientEntry(entry)),
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
      memoryChunkCount: 0,
    };
  }

  async findAll(userId: string, options: { limit?: number } = {}) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) return [];

    const entries = await this.prisma.diaryEntry.findMany({
      where: { user_id: user.id },
      select: {
        id: true,
        raw_text: true,
        status: true,
        mood: true,
        tags: true,
        entry_date: true,
        created_at: true,
        updated_at: true,
        attachments: {
          select: {
            id: true,
            storage_path: true,
            file_type: true,
            extracted_text: true,
            created_at: true,
          },
          orderBy: { created_at: 'asc' },
        },
        calendar_events: {
          select: {
            id: true,
            title: true,
            start_time: true,
            end_time: true,
            html_link: true,
          },
          orderBy: { start_time: 'asc' },
        },
      },
      orderBy: [{ entry_date: 'desc' }, { created_at: 'desc' }],
      take: options.limit ?? 100,
    });

    return Promise.all(entries.map((entry) => this.toClientEntry(entry)));
  }

  async findOne(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('Diary entry not found');

    const entry = await this.prisma.diaryEntry.findFirst({
      where: { id, user_id: user.id },
      include: {
        attachments: {
          orderBy: { created_at: 'asc' },
        },
        calendar_events: {
          orderBy: { start_time: 'asc' },
        },
      },
    });
    if (!entry) throw new NotFoundException('Diary entry not found');
    return this.toClientEntry(entry);
  }

  async update(userId: string, id: string, dto: Partial<CreateDiaryDto>) {
    const { user, entry: existingEntry } = await this.findOwnedEntry(
      userId,
      id,
    );
    const existingClientEntry = await this.toClientEntry(existingEntry);
    const title = dto.title ?? existingClientEntry.title;
    const content = dto.content ?? existingClientEntry.content;
    const rawText = this.buildRawText(title, content);
    const entryDate = dto.entryDate ? new Date(dto.entryDate) : undefined;
    const mood = this.normalizeMood(dto.mood);
    const tags =
      dto.tags === undefined ? undefined : this.normalizeTags(dto.tags);

    const entry = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.diaryEntry.update({
        where: { id },
        data: {
          raw_text: rawText,
          ...(dto.mood !== undefined ? { mood } : {}),
          ...(tags !== undefined ? { tags } : {}),
          ...(entryDate ? { entry_date: entryDate } : {}),
        },
      });

      await this.enqueueIndexingJob(tx, {
        userId: user.id,
        sourceType: 'diary',
        sourceId: id,
        payload: {
          sourceTitle: title,
          mood: dto.mood !== undefined ? mood : existingClientEntry.mood,
          tags: tags ?? existingClientEntry.tags,
        },
      });

      return updated;
    });

    return {
      ...(await this.toClientEntry(entry)),
      memoryIndexed: false,
      memoryIndexingStatus: 'queued',
      memoryChunkCount: 0,
    };
  }

  async remove(userId: string, id: string) {
    const { user } = await this.findOwnedEntry(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await deleteMemoryChunksForSource(tx, {
        userId: user.id,
        sourceType: 'diary',
        sourceId: id,
      });

      await tx.searchHistory?.updateMany?.({
        where: {
          user_id: user.id,
          expires_at: { gt: new Date() },
        },
        data: { expires_at: new Date() },
      });
      await invalidateUserSearchCache(user.id);

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

  private async enqueueIndexingJob(
    tx: any,
    input: {
      userId: string;
      sourceType: 'diary';
      sourceId: string;
      payload?: Record<string, unknown>;
    },
  ) {
    const job = await tx.indexingOutbox.upsert({
      where: {
        job_type_source_type_source_id: {
          job_type: 'index_memory',
          source_type: input.sourceType,
          source_id: input.sourceId,
        },
      },
      update: {
        user_id: input.userId,
        status: 'pending',
        retry_count: 0,
        error: null,
        payload: input.payload ?? {},
        run_after: new Date(),
        locked_at: null,
        locked_by: null,
        processed_at: null,
      },
      create: {
        user_id: input.userId,
        job_type: 'index_memory',
        source_type: input.sourceType,
        source_id: input.sourceId,
        status: 'pending',
        payload: input.payload ?? {},
      },
    });

    await tx.searchHistory?.updateMany?.({
      where: {
        user_id: input.userId,
        expires_at: { gt: new Date() },
      },
      data: { expires_at: new Date() },
    });
    await invalidateUserSearchCache(input.userId);

    return job;
  }

  private buildRawText(title: string, content: string) {
    return `${title.trim()}\n\n${content.trim()}`;
  }

  private normalizeMood(value?: string | null): DiaryMood | null {
    if (!value) return null;

    const normalized = value.trim().toLowerCase();
    return DIARY_MOODS.includes(normalized as DiaryMood)
      ? (normalized as DiaryMood)
      : null;
  }

  private normalizeTags(tags?: string[] | null) {
    if (!tags?.length) return [];

    const seen = new Set<string>();
    const normalizedTags: string[] = [];

    for (const tag of tags) {
      const normalized = tag
        .trim()
        .toLowerCase()
        .replace(/^#+/, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');

      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      normalizedTags.push(normalized);

      if (normalizedTags.length >= 12) break;
    }

    return normalizedTags;
  }

  private async toClientEntry(entry: {
    id: string;
    raw_text: string;
    status: string;
    mood?: string | null;
    tags?: string[] | null;
    created_at: Date;
    updated_at: Date;
    entry_date?: Date | null;
    attachments?: {
      id: string;
      storage_path: string;
      file_type: string;
      extracted_text: string | null;
      created_at: Date;
    }[];
    calendar_events?: {
      id: string;
      title: string;
      start_time: Date;
      end_time: Date;
      html_link?: string | null;
    }[];
  }) {
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

    const attachments = await this.toClientAttachments(entry.attachments ?? []);

    return {
      id: entry.id,
      title: title || 'Untitled',
      content: content || trimmedText || 'No content',
      attachments,
      calendarEvents: (entry.calendar_events ?? []).map((event) => ({
        id: event.id,
        title: event.title,
        startTime: event.start_time.toISOString(),
        endTime: event.end_time.toISOString(),
        htmlLink: event.html_link ?? null,
      })),
      mood: this.normalizeMood(entry.mood) ?? null,
      tags: entry.tags ?? [],
      status: entry.status,
      entryDate: entry.entry_date?.toISOString(),
      createdAt: entry.created_at.toISOString(),
      updatedAt: entry.updated_at.toISOString(),
    };
  }

  private async toClientAttachments(
    attachments: Array<{
      id: string;
      storage_path: string;
      file_type: string;
      extracted_text: string | null;
      created_at: Date;
    }>,
  ) {
    if (!attachments.length) return [];

    const jobs = await this.prisma.indexingOutbox.findMany({
      where: {
        job_type: 'index_memory',
        source_type: 'attachment',
        source_id: { in: attachments.map((attachment) => attachment.id) },
      },
      select: {
        source_id: true,
        status: true,
        error: true,
        retry_count: true,
        updated_at: true,
      },
    });
    const jobsBySourceId = new Map(jobs.map((job) => [job.source_id, job]));

    return Promise.all(
      attachments.map(async (attachment) => {
        const extractedText = attachment.extracted_text?.trim() ?? '';
        const extractionFailed = isAttachmentExtractionFallback(extractedText);
        const usableExtractedText = extractionFailed ? '' : extractedText;
        const signedUrl = await this.storageService
          .createSignedUrl('attachments-bucket', attachment.storage_path)
          .catch(() => undefined);
        const job = jobsBySourceId.get(attachment.id);

        return {
          id: attachment.id,
          fileType: attachment.file_type,
          fileName: this.getStoredFileName(attachment.storage_path),
          signedUrl,
          extractionStatus: extractionFailed
            ? 'failed'
            : usableExtractedText
              ? 'extracted'
              : 'pending',
          extractedTextPreview: usableExtractedText
            ? usableExtractedText.slice(0, 800)
            : undefined,
          extractedCharacterCount: usableExtractedText.length,
          indexingStatus: extractionFailed
            ? 'failed'
            : (job?.status ?? 'unknown'),
          indexingError: extractionFailed
            ? 'AI could not read this file. Retry the scan to extract its real content.'
            : (job?.error ?? null),
          retryCount: job?.retry_count ?? 0,
          updatedAt: (job?.updated_at ?? attachment.created_at).toISOString(),
          createdAt: attachment.created_at.toISOString(),
        };
      }),
    );
  }

  private getStoredFileName(storagePath: string) {
    const storedName = storagePath.split('/').pop() ?? storagePath;
    return storedName.replace(/^[0-9a-f-]{36}-/i, '');
  }

  // ---------------------------------------------------------------------------
  // AI Writing Copilot
  // ---------------------------------------------------------------------------
  async copilot(userId: string, text: string, action: string) {
    const modelName = getTuturuuuAnswerModel();
    const systemContext = [
      'You are the AI Writing Copilot for a Smart Personal Diary app called "Second Brain".',
      'The user writes daily diary entries to record their thoughts, emotions, and activities.',
      'Always preserve the original language of the text (Vietnamese, English, or mixed).',
      'Never add greetings, meta-commentary, or markdown formatting — return only the resulting text.',
    ].join(' ');

    let taskInstruction: string;

    switch (action) {
      case 'continue':
        taskInstruction = [
          'Continue writing this diary entry naturally.',
          'Match the tone, style, and language of the original text.',
          'Write 2-4 additional sentences that logically follow.',
          'Return ONLY the continuation — do NOT repeat the original text.',
        ].join('\n');
        break;

      case 'fix_grammar':
        taskInstruction = [
          'Fix all grammar, spelling, and punctuation errors in this diary entry.',
          'Keep the original meaning, tone, and language exactly as intended.',
          'Return ONLY the corrected full text.',
        ].join('\n');
        break;

      case 'expand':
        taskInstruction = [
          'Expand this diary entry with more vivid details, sensory descriptions, and deeper reflection.',
          'Keep the original meaning and language.',
          'Roughly double the length while maintaining the authentic diary voice.',
          'Return ONLY the expanded full text.',
        ].join('\n');
        break;

      case 'summarize':
        taskInstruction = [
          'Summarize this diary entry into a concise 2-3 sentence overview.',
          'Capture the key events, emotions, and insights.',
          'Keep the same language as the original.',
          'Return ONLY the summary.',
        ].join('\n');
        break;

      case 'reflect':
        taskInstruction = [
          'Write one thoughtful, open-ended question that helps the author reflect more deeply on this specific diary entry.',
          'Ground the question in a concrete emotion, event, tension, or detail from the entry.',
          'Keep the same language as the original.',
          'Use one sentence and return ONLY the question.',
        ].join('\n');
        break;

      default:
        throw new BadRequestException(`Invalid copilot action: "${action}"`);
    }

    const prompt = `${systemContext}\n\n### Task\n${taskInstruction}\n\n### Diary Entry\n${text}`;

    try {
      const generatedText = await generateAiText({
        model: modelName,
        prompt,
        temperature: 0.7,
      });
      return { result: generatedText };
    } catch (error) {
      console.error(
        `Copilot AI Error [action=${action}, model=${modelName}]:`,
        error,
      );
      throw new InternalServerErrorException(
        'AI writing assistant is temporarily unavailable. Please try again.',
      );
    }
  }
}

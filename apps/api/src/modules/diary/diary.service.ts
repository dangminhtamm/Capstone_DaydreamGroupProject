import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
        ...(dto.entryDate ? { entry_date: new Date(dto.entryDate) } : {}),
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
    const entryDate = dto.entryDate ? new Date(dto.entryDate) : undefined;

    const entry = await this.prisma.diaryEntry.update({
      where: { id },
      data: {
        raw_text: rawText,
        ...(entryDate ? { entry_date: entryDate } : {}),
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
          data: {
            raw_text: existingEntry.raw_text,
            entry_date: existingEntry.entry_date,
          },
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

  private toClientEntry(entry: { id: string; raw_text: string; status: string; created_at: Date; updated_at: Date; entry_date?: Date }) {
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
      entryDate: entry.entry_date?.toISOString(),
      createdAt: entry.created_at.toISOString(),
      updatedAt: entry.updated_at.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // AI Writing Copilot
  // ---------------------------------------------------------------------------
  private _geminiClient: GoogleGenerativeAI | null = null;

  private getGeminiClient(): GoogleGenerativeAI {
    if (!this._geminiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException('GEMINI_API_KEY is not configured');
      }
      this._geminiClient = new GoogleGenerativeAI(apiKey);
    }
    return this._geminiClient;
  }

  async copilot(userId: string, text: string, action: string) {
    const modelName = process.env.GEMINI_ANSWER_MODEL ?? 'gemini-2.5-flash';
    const model = this.getGeminiClient().getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0.7 },
    });

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

      default:
        throw new BadRequestException(`Invalid copilot action: "${action}"`);
    }

    const prompt = `${systemContext}\n\n### Task\n${taskInstruction}\n\n### Diary Entry\n${text}`;

    try {
      const result = await model.generateContent(prompt);
      const generatedText = result.response.text().trim();
      return { result: generatedText };
    } catch (error) {
      console.error(`Copilot AI Error [action=${action}, model=${modelName}]:`, error);
      throw new InternalServerErrorException('AI writing assistant is temporarily unavailable. Please try again.');
    }
  }
}

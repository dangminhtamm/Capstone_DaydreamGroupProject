import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../prisma/prisma.service';
import { invalidateUserSearchCache } from '../../common/cache/search-answer-cache';
import type { CreateSummaryDto } from './dto/create-summary.dto';
import type { SummaryType } from './dto/list-summaries-query.dto';

type SummaryRecord = {
  id: string;
  summary_type: string;
  content: string;
  period_start: Date;
  period_end: Date;
  created_at: Date;
};

type GenerateSummaryInput = {
  type: SummaryType;
  date?: string;
  force?: boolean;
};

type AuthenticatedUserInput = {
  supabaseId: string;
  email: string;
};

@Injectable()
export class SummaryService {
  private _geminiClient: GoogleGenerativeAI | null = null;

  constructor(private prisma: PrismaService) {}

  async findAll(
    authUser: AuthenticatedUserInput | string,
    options: {
      type?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
  ) {
    const user = await this.findOrCreateUser(authUser);

    const summaries = await this.prisma.summary.findMany({
      where: {
        user_id: user.id,
        ...(options.type && { summary_type: options.type }),
        ...(options.startDate || options.endDate
          ? {
              period_start: {
                ...(options.startDate && { gte: new Date(options.startDate) }),
                ...(options.endDate && { lte: new Date(options.endDate) }),
              },
            }
          : {}),
      },
      orderBy: { created_at: 'desc' },
      take: options.limit ?? 20,
    });

    return {
      count: summaries.length,
      summaries: summaries.map((summary) => this.toClientSummary(summary)),
    };
  }

  async findOne(authUser: AuthenticatedUserInput | string, summaryId: string) {
    const user = await this.findOrCreateUser(authUser);

    const summary = await this.prisma.summary.findFirst({
      where: {
        id: summaryId,
        user_id: user.id,
      },
    });

    if (!summary) {
      throw new NotFoundException('Summary not found');
    }

    return this.toClientSummary(summary);
  }

  async generateSummary(authUser: AuthenticatedUserInput | string, dto: CreateSummaryDto) {
    const user = await this.findOrCreateUser(authUser);
    return this.generateSummaryForUserId(user.id, dto);
  }

  async generateSummaryForUserId(userId: string, input: GenerateSummaryInput) {
    const anchorDate = input.date ? new Date(input.date) : new Date();
    if (!Number.isFinite(anchorDate.getTime())) {
      throw new BadRequestException('Invalid summary date.');
    }

    const period = getSummaryPeriod(input.type, anchorDate);
    const summaryPeriodKey = {
      user_id: userId,
      summary_type: input.type,
      period_start: period.start,
      period_end: period.end,
    };
    const existing = await this.prisma.summary.findFirst({
      where: summaryPeriodKey,
    });

    if (existing && !input.force) {
      await this.enqueueSummaryIndexingJob(this.prisma, {
        userId,
        summaryId: existing.id,
      });

      return {
        generated: false,
        summary: this.toClientSummary(existing),
        memoryIndexingStatus: 'queued',
      };
    }

    const context = await this.buildSummaryContext(userId, input.type, period);
    if (!context.hasContent) {
      throw new BadRequestException(
        `No diary, calendar, or lower-level summaries found for this ${input.type} period.`,
      );
    }

    const content = await this.generateAiSummary(input.type, period, context.text);
    const summary = await this.prisma.$transaction(async (tx) => {
      const savedSummary = await tx.summary.upsert({
        where: {
          user_id_summary_type_period_start_period_end: summaryPeriodKey,
        },
        update: { content },
        create: {
          ...summaryPeriodKey,
          content,
        },
      });

      await this.enqueueSummaryIndexingJob(tx, {
        userId,
        summaryId: savedSummary.id,
      });

      return savedSummary;
    });

    return {
      generated: true,
      summary: this.toClientSummary(summary),
      memoryIndexingStatus: 'queued',
    };
  }

  private async findOrCreateUser(authUser: AuthenticatedUserInput | string) {
    if (typeof authUser === 'string') {
      const user = await this.prisma.user.findUnique({
        where: { supabaseId: authUser },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    }

    return this.prisma.user.upsert({
      where: { supabaseId: authUser.supabaseId },
      update: { email: authUser.email },
      create: {
        supabaseId: authUser.supabaseId,
        email: authUser.email,
      },
      select: { id: true },
    });
  }

  private async enqueueSummaryIndexingJob(
    tx: any,
    input: {
      userId: string;
      summaryId: string;
    },
  ) {
    const job = await tx.indexingOutbox.upsert({
      where: {
        job_type_source_type_source_id: {
          job_type: 'index_memory',
          source_type: 'summary',
          source_id: input.summaryId,
        },
      },
      update: {
        user_id: input.userId,
        status: 'pending',
        retry_count: 0,
        error: null,
        payload: {},
        run_after: new Date(),
        locked_at: null,
        processed_at: null,
      },
      create: {
        user_id: input.userId,
        job_type: 'index_memory',
        source_type: 'summary',
        source_id: input.summaryId,
        status: 'pending',
        payload: {},
      },
    });

    await this.expireSearchCache(tx, input.userId);
    return job;
  }

  private async expireSearchCache(tx: any, userId: string) {
    await tx.searchHistory?.updateMany?.({
      where: {
        user_id: userId,
        expires_at: { gt: new Date() },
      },
      data: { expires_at: new Date() },
    });
    await invalidateUserSearchCache(userId);
  }

  private async buildSummaryContext(
    userId: string,
    type: SummaryType,
    period: { start: Date; end: Date },
  ) {
    if (type === 'weekly') {
      const dailySummaries = await this.findLowerSummaries(userId, 'daily', period);
      if (dailySummaries.length) {
        return {
          hasContent: true,
          text: formatSummaryList('Daily summaries', dailySummaries),
        };
      }
    }

    if (type === 'monthly') {
      const weeklySummaries = await this.findLowerSummaries(userId, 'weekly', period);
      if (weeklySummaries.length) {
        return {
          hasContent: true,
          text: formatSummaryList('Weekly summaries', weeklySummaries),
        };
      }

      const dailySummaries = await this.findLowerSummaries(userId, 'daily', period);
      if (dailySummaries.length) {
        return {
          hasContent: true,
          text: formatSummaryList('Daily summaries', dailySummaries),
        };
      }
    }

    if (type === 'yearly') {
      const monthlySummaries = await this.findLowerSummaries(userId, 'monthly', period);
      if (monthlySummaries.length) {
        return {
          hasContent: true,
          text: formatSummaryList('Monthly summaries', monthlySummaries),
        };
      }

      const weeklySummaries = await this.findLowerSummaries(userId, 'weekly', period);
      if (weeklySummaries.length) {
        return {
          hasContent: true,
          text: formatSummaryList('Weekly summaries', weeklySummaries),
        };
      }
    }

    return this.buildRawActivityContext(userId, period);
  }

  private async findLowerSummaries(
    userId: string,
    type: SummaryType,
    period: { start: Date; end: Date },
  ) {
    return this.prisma.summary.findMany({
      where: {
        user_id: userId,
        summary_type: type,
        period_start: { gte: period.start },
        period_end: { lte: period.end },
      },
      orderBy: { period_start: 'asc' },
    });
  }

  private async buildRawActivityContext(
    userId: string,
    period: { start: Date; end: Date },
  ) {
    const itemLimit = this.getSummaryContextItemLimit();
    const [diaries, events] = await Promise.all([
      this.prisma.diaryEntry.findMany({
        where: {
          user_id: userId,
          entry_date: { gte: period.start, lte: period.end },
        },
        orderBy: { entry_date: 'asc' },
        take: itemLimit,
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          user_id: userId,
          start_time: { gte: period.start, lte: period.end },
        },
        orderBy: { start_time: 'asc' },
        take: itemLimit,
      }),
    ]);

    const sections: string[] = [];
    if (diaries.length) {
      sections.push(
        [
          'Diary entries:',
          ...diaries.map((entry) =>
            `- ${entry.entry_date.toISOString()}: ${entry.raw_text}`,
          ),
        ].join('\n'),
      );
    }

    if (events.length) {
      sections.push(
        [
          'Calendar events:',
          ...events.map((event) =>
            `- ${event.start_time.toISOString()}-${event.end_time.toISOString()}: ${event.title}${
              event.description ? ` - ${event.description}` : ''
            }`,
          ),
        ].join('\n'),
      );
    }

    return {
      hasContent: sections.length > 0,
      text: this.truncateSummaryContext(sections.join('\n\n')),
    };
  }

  private async generateAiSummary(
    type: SummaryType,
    period: { start: Date; end: Date },
    context: string,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');
    }

    const model = this.getGeminiClient(apiKey).getGenerativeModel({
      model: process.env.GEMINI_SUMMARY_MODEL ?? process.env.GEMINI_ANSWER_MODEL ?? 'gemini-2.5-flash',
    });

    const prompt = buildSummaryPrompt(type, period, context);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    if (!text) {
      throw new InternalServerErrorException('AI returned an empty summary.');
    }

    return sanitizeSummaryContent(text);
  }

  private getGeminiClient(apiKey: string) {
    if (!this._geminiClient) {
      this._geminiClient = new GoogleGenerativeAI(apiKey);
    }

    return this._geminiClient;
  }

  private getSummaryContextItemLimit() {
    const configured = Number(process.env.SUMMARY_CONTEXT_ITEM_LIMIT ?? 80);
    if (!Number.isFinite(configured)) return 80;
    return Math.min(Math.max(Math.floor(configured), 10), 200);
  }

  private truncateSummaryContext(context: string) {
    const maxChars = Number(process.env.SUMMARY_CONTEXT_MAX_CHARS ?? 24_000);
    if (!Number.isFinite(maxChars) || maxChars <= 0 || context.length <= maxChars) {
      return context;
    }

    return `${context.slice(0, maxChars)}\n\n[Context truncated to keep the summary request within budget.]`;
  }

  private toClientSummary(summary: SummaryRecord) {
    return {
      id: summary.id,
      type: summary.summary_type,
      content: sanitizeSummaryContent(summary.content),
      periodStart: summary.period_start?.toISOString?.() ?? summary.period_start,
      periodEnd: summary.period_end?.toISOString?.() ?? summary.period_end,
      createdAt: summary.created_at?.toISOString?.() ?? summary.created_at,
    };
  }
}

function getSummaryPeriod(type: SummaryType, anchor: Date) {
  if (type === 'daily') {
    const start = startOfUtcDay(anchor);
    return { start, end: endOfUtcDay(start) };
  }

  if (type === 'weekly') {
    const start = startOfUtcWeek(anchor);
    return { start, end: new Date(start.getTime() + 7 * dayMs - 1) };
  }

  if (type === 'monthly') {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1) - 1);
    return { start, end };
  }

  const start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(anchor.getUTCFullYear() + 1, 0, 1) - 1);
  return { start, end };
}

const dayMs = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(start: Date) {
  return new Date(start.getTime() + dayMs - 1);
}

function startOfUtcWeek(date: Date) {
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = startOfUtcDay(date);
  return new Date(start.getTime() + mondayOffset * dayMs);
}

function formatSummaryList(label: string, summaries: SummaryRecord[]) {
  return [
    `${label}:`,
    ...summaries.map((summary) =>
      `- ${summary.period_start.toISOString()} to ${summary.period_end.toISOString()}: ${summary.content}`,
    ),
  ].join('\n');
}

function buildSummaryPrompt(
  type: SummaryType,
  period: { start: Date; end: Date },
  context: string,
) {
  const instructions = {
    daily:
      'Create a concise daily log. Capture concrete events, accomplishments, mood if evident, and notable follow-ups.',
    weekly:
      'Create a weekly review. Identify key events, progress, recurring themes, blockers, and 2-3 practical next steps.',
    monthly:
      'Create a monthly retrospective. Highlight major accomplishments, patterns, challenges, changes in habits/mood, and next-month suggestions.',
    yearly:
      'Create a yearly retrospective. Summarize major themes, milestones, recurring patterns, growth areas, and thoughtful recommendations for next year.',
  } satisfies Record<SummaryType, string>;

  return `
You are the reflection engine for a personal Second Brain diary.

Summary type: ${type}
Period: ${period.start.toISOString()} to ${period.end.toISOString()}

Task:
${instructions[type]}

Rules:
- Use only the supplied context.
- Do not invent people, events, dates, emotions, or outcomes.
- Prefer specific details over generic encouragement.
- If evidence is thin, say so briefly.
- Respond in clear English with short plain-text sections.
- Do not use Markdown emphasis. Never wrap headings, labels, or phrases in **.

Context:
${context}
`.trim();
}

function sanitizeSummaryContent(content: string) {
  return content
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../prisma/prisma.service';
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

@Injectable()
export class SummaryService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    supabaseUserId: string,
    options: {
      type?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
  ) {
    const user = await this.findUserOrThrow(supabaseUserId);

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

  async findOne(supabaseUserId: string, summaryId: string) {
    const user = await this.findUserOrThrow(supabaseUserId);

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

  async generateSummary(supabaseUserId: string, dto: CreateSummaryDto) {
    const user = await this.findUserOrThrow(supabaseUserId);
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
      return {
        generated: false,
        summary: this.toClientSummary(existing),
      };
    }

    const context = await this.buildSummaryContext(userId, input.type, period);
    if (!context.hasContent) {
      throw new BadRequestException(
        `No diary, calendar, or lower-level summaries found for this ${input.type} period.`,
      );
    }

    const content = await this.generateAiSummary(input.type, period, context.text);
    const summary = await this.prisma.summary.upsert({
      where: {
        user_id_summary_type_period_start_period_end: summaryPeriodKey,
      },
      update: { content },
      create: {
        ...summaryPeriodKey,
        content,
      },
    });

    return {
      generated: true,
      summary: this.toClientSummary(summary),
    };
  }

  private async findUserOrThrow(supabaseUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: supabaseUserId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
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
    const [diaries, events] = await Promise.all([
      this.prisma.diaryEntry.findMany({
        where: {
          user_id: userId,
          entry_date: { gte: period.start, lte: period.end },
        },
        orderBy: { entry_date: 'asc' },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          user_id: userId,
          start_time: { gte: period.start, lte: period.end },
        },
        orderBy: { start_time: 'asc' },
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
      text: sections.join('\n\n'),
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

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: process.env.GEMINI_SUMMARY_MODEL ?? process.env.GEMINI_ANSWER_MODEL ?? 'gemini-2.5-flash',
    });

    const prompt = buildSummaryPrompt(type, period, context);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    if (!text) {
      throw new InternalServerErrorException('AI returned an empty summary.');
    }

    return text;
  }

  private toClientSummary(summary: SummaryRecord) {
    return {
      id: summary.id,
      type: summary.summary_type,
      content: summary.content,
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
- Respond in clear English with short sections.

Context:
${context}
`.trim();
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiSummaryModel } from '@second-brain/ai';
import * as cron from 'node-cron';
import { prisma } from '../../lib/prisma';

type SummaryType = 'daily' | 'weekly' | 'monthly' | 'yearly';

type Period = {
  start: Date;
  end: Date;
};

async function generateSummaryForUser(
  userId: string,
  type: SummaryType,
  anchorDate = new Date(),
  force = false,
) {
  const period = getSummaryPeriod(type, anchorDate);
  const summaryPeriodKey = {
    user_id: userId,
    summary_type: type,
    period_start: period.start,
    period_end: period.end,
  };
  const existing = await prisma.summary.findFirst({
    where: summaryPeriodKey,
  });

  if (existing && !force) {
    console.log(
      `[Worker - ${type} Summary] Existing summary found for ${userId}; skipping duplicate.`,
    );
    await enqueueSummaryIndexingJob(userId, existing.id);
    return existing;
  }

  const context = await buildSummaryContext(userId, type, period);
  if (!context.hasContent) {
    console.log(
      `[Worker - ${type} Summary] No source activity found for ${userId}; skipping.`,
    );
    return null;
  }

  const content = await callAI(type, period, context.text);
  return prisma.$transaction(async (tx) => {
    const summary = await tx.summary.upsert({
      where: {
        user_id_summary_type_period_start_period_end: summaryPeriodKey,
      },
      update: { content },
      create: {
        ...summaryPeriodKey,
        content,
      },
    });

    await enqueueSummaryIndexingJob(userId, summary.id, tx);
    return summary;
  });
}

async function enqueueSummaryIndexingJob(userId: string, summaryId: string, tx: any = prisma) {
  return tx.indexingOutbox.upsert({
    where: {
      job_type_source_type_source_id: {
        job_type: 'index_memory',
        source_type: 'summary',
        source_id: summaryId,
      },
    },
    update: {
      user_id: userId,
      status: 'pending',
      retry_count: 0,
      error: null,
      payload: {},
      run_after: new Date(),
      locked_at: null,
      processed_at: null,
    },
    create: {
      user_id: userId,
      job_type: 'index_memory',
      source_type: 'summary',
      source_id: summaryId,
      status: 'pending',
      payload: {},
    },
  });
}

async function buildSummaryContext(userId: string, type: SummaryType, period: Period) {
  if (type === 'weekly') {
    const dailySummaries = await findLowerSummaries(userId, 'daily', period);
    if (dailySummaries.length) {
      return { hasContent: true, text: formatSummaryList('Daily summaries', dailySummaries) };
    }
  }

  if (type === 'monthly') {
    const weeklySummaries = await findLowerSummaries(userId, 'weekly', period);
    if (weeklySummaries.length) {
      return { hasContent: true, text: formatSummaryList('Weekly summaries', weeklySummaries) };
    }

    const dailySummaries = await findLowerSummaries(userId, 'daily', period);
    if (dailySummaries.length) {
      return { hasContent: true, text: formatSummaryList('Daily summaries', dailySummaries) };
    }
  }

  if (type === 'yearly') {
    const monthlySummaries = await findLowerSummaries(userId, 'monthly', period);
    if (monthlySummaries.length) {
      return { hasContent: true, text: formatSummaryList('Monthly summaries', monthlySummaries) };
    }

    const weeklySummaries = await findLowerSummaries(userId, 'weekly', period);
    if (weeklySummaries.length) {
      return { hasContent: true, text: formatSummaryList('Weekly summaries', weeklySummaries) };
    }
  }

  return buildRawActivityContext(userId, period);
}

function findLowerSummaries(userId: string, type: SummaryType, period: Period) {
  return prisma.summary.findMany({
    where: {
      user_id: userId,
      summary_type: type,
      period_start: { gte: period.start },
      period_end: { lte: period.end },
    },
    orderBy: { period_start: 'asc' },
  });
}

async function buildRawActivityContext(userId: string, period: Period) {
  const [diaries, events] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: {
        user_id: userId,
        entry_date: { gte: period.start, lte: period.end },
      },
      orderBy: { entry_date: 'asc' },
    }),
    prisma.calendarEvent.findMany({
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
        ...diaries.map((entry) => `- ${entry.entry_date.toISOString()}: ${entry.raw_text}`),
      ].join('\n'),
    );
  }

  if (events.length) {
    sections.push(
      [
        'Calendar events:',
        ...events.map(
          (event) =>
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

async function callAI(type: SummaryType, period: Period, context: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing in environment variables.');

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: getGeminiSummaryModel(),
  });

  const result = await model.generateContent(buildSummaryPrompt(type, period, context));
  const text = result.response.text().trim();
  if (!text) throw new Error('Gemini returned an empty summary.');
  return sanitizeSummaryContent(text);
}

const dayMs = 24 * 60 * 60 * 1000;

function getSummaryPeriod(type: SummaryType, anchor: Date): Period {
  if (type === 'daily') {
    const start = startOfUtcDay(anchor);
    return { start, end: new Date(start.getTime() + dayMs - 1) };
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

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date) {
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(startOfUtcDay(date).getTime() + mondayOffset * dayMs);
}

function formatSummaryList(label: string, summaries: Array<{ period_start: Date; period_end: Date; content: string }>) {
  return [
    `${label}:`,
    ...summaries.map(
      (summary) =>
        `- ${summary.period_start.toISOString()} to ${summary.period_end.toISOString()}: ${summary.content}`,
    ),
  ].join('\n');
}

function buildSummaryPrompt(type: SummaryType, period: Period, context: string) {
  const instructions: Record<SummaryType, string> = {
    daily:
      'Create a concise daily log. Capture concrete events, accomplishments, mood if evident, and notable follow-ups.',
    weekly:
      'Create a weekly review. Identify key events, progress, recurring themes, blockers, and 2-3 practical next steps.',
    monthly:
      'Create a monthly retrospective. Highlight major accomplishments, patterns, challenges, changes in habits/mood, and next-month suggestions.',
    yearly:
      'Create a yearly retrospective. Summarize major themes, milestones, recurring patterns, growth areas, and thoughtful recommendations for next year.',
  };

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

async function runForAllUsers(type: SummaryType, anchorDate = new Date()) {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    try {
      await generateSummaryForUser(user.id, type, anchorDate);
    } catch (error) {
      console.error(
        `[Worker - ${type} Summary] Failed for User ${user.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

export class SummaryPipelineJob {
  static generateDailySummaryForUser(userId: string, anchorDate = new Date(), force = false) {
    return generateSummaryForUser(userId, 'daily', anchorDate, force);
  }

  static startCron() {
    cron.schedule('50 23 * * *', async () => {
      console.log('[Cron] Triggering Daily Summary pipeline (23:50)');
      await runForAllUsers('daily');
    });
    console.log('Background Worker for Daily Summary Pipeline started.');
  }
}

export class WeeklySummaryPipelineJob {
  static generateWeeklySummaryForUser(userId: string, anchorDate = new Date(), force = false) {
    return generateSummaryForUser(userId, 'weekly', anchorDate, force);
  }

  static startCron() {
    cron.schedule('55 23 * * 0', async () => {
      console.log('[Cron] Triggering Weekly Summary pipeline (Sunday 23:55)');
      await runForAllUsers('weekly');
    });
    console.log('Background Worker for Weekly Summary Pipeline started.');
  }
}

export class MonthlySummaryPipelineJob {
  static generateMonthlySummaryForUser(userId: string, anchorDate = new Date(), force = false) {
    return generateSummaryForUser(userId, 'monthly', anchorDate, force);
  }

  static startCron() {
    cron.schedule('58 23 28-31 * *', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + dayMs);
      if (tomorrow.getUTCDate() !== 1) return;

      console.log('[Cron] Triggering Monthly Summary pipeline (last day of month, 23:58)');
      await runForAllUsers('monthly', now);
    });
    console.log('Background Worker for Monthly Summary Pipeline started.');
  }
}

export class YearlySummaryPipelineJob {
  static generateYearlySummaryForUser(userId: string, anchorDate = new Date(), force = false) {
    return generateSummaryForUser(userId, 'yearly', anchorDate, force);
  }

  static startCron() {
    cron.schedule('59 23 31 12 *', async () => {
      console.log('[Cron] Triggering Yearly Summary pipeline (Dec 31 23:59)');
      await runForAllUsers('yearly');
    });
    console.log('Background Worker for Yearly Summary Pipeline started.');
  }
}

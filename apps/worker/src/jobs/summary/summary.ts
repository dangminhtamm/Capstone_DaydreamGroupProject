import {
  formatSummaryDateTime,
  formatSummaryPeriodRange,
  generateAiText,
  getSummaryPeriod,
  getTuturuuuSummaryModel,
  isLastLocalDayOfMonth,
  resolveSummaryTimeZone,
  type SummaryPeriod,
} from '@second-brain/ai';
import * as cron from 'node-cron';
import { prisma } from '../../lib/prisma';

type SummaryType = 'daily' | 'weekly' | 'monthly' | 'yearly';

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
      locked_by: null,
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

async function buildSummaryContext(userId: string, type: SummaryType, period: SummaryPeriod) {
  if (type === 'weekly') {
    const dailySummaries = await findLowerSummaries(userId, 'daily', period);
    if (dailySummaries.length) {
      return {
        hasContent: true,
        text: formatSummaryList('Daily summaries', dailySummaries, period.timeZone),
      };
    }
  }

  if (type === 'monthly') {
    const weeklySummaries = await findLowerSummaries(userId, 'weekly', period);
    if (weeklySummaries.length) {
      return {
        hasContent: true,
        text: formatSummaryList('Weekly summaries', weeklySummaries, period.timeZone),
      };
    }

    const dailySummaries = await findLowerSummaries(userId, 'daily', period);
    if (dailySummaries.length) {
      return {
        hasContent: true,
        text: formatSummaryList('Daily summaries', dailySummaries, period.timeZone),
      };
    }
  }

  if (type === 'yearly') {
    const monthlySummaries = await findLowerSummaries(userId, 'monthly', period);
    if (monthlySummaries.length) {
      return {
        hasContent: true,
        text: formatSummaryList('Monthly summaries', monthlySummaries, period.timeZone),
      };
    }

    const weeklySummaries = await findLowerSummaries(userId, 'weekly', period);
    if (weeklySummaries.length) {
      return {
        hasContent: true,
        text: formatSummaryList('Weekly summaries', weeklySummaries, period.timeZone),
      };
    }
  }

  return buildRawActivityContext(userId, period);
}

function findLowerSummaries(userId: string, type: SummaryType, period: SummaryPeriod) {
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

async function buildRawActivityContext(userId: string, period: SummaryPeriod) {
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
        ...diaries.map(
          (entry) =>
            `- ${formatSummaryDateTime(entry.entry_date, period.timeZone)}: ${entry.raw_text}`,
        ),
      ].join('\n'),
    );
  }

  if (events.length) {
    sections.push(
      [
        'Calendar events:',
        ...events.map(
          (event) =>
            `- ${formatSummaryDateTime(event.start_time, period.timeZone)}-${formatSummaryDateTime(
              event.end_time,
              period.timeZone,
            )}: ${event.title}${
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

async function callAI(type: SummaryType, period: SummaryPeriod, context: string) {
  const text = await generateAiText({
    model: getTuturuuuSummaryModel(),
    prompt: buildSummaryPrompt(type, period, context),
  });
  if (!text) throw new Error('AI returned an empty summary.');
  return sanitizeSummaryContent(text);
}

function formatSummaryList(
  label: string,
  summaries: Array<{ period_start: Date; period_end: Date; content: string }>,
  timeZone: string,
) {
  return [
    `${label}:`,
    ...summaries.map(
      (summary) =>
        `- ${formatSummaryDateTime(summary.period_start, timeZone)} to ${formatSummaryDateTime(
          summary.period_end,
          timeZone,
        )}: ${summary.content}`,
    ),
  ].join('\n');
}

function buildSummaryPrompt(type: SummaryType, period: SummaryPeriod, context: string) {
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
Period: ${formatSummaryPeriodRange(period)}

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
    const summaryTimeZone = resolveSummaryTimeZone();
    cron.schedule('50 23 * * *', async () => {
      console.log(`[Cron] Triggering Daily Summary pipeline (23:50 ${summaryTimeZone})`);
      await runForAllUsers('daily');
    }, { timezone: summaryTimeZone });
    console.log('Background Worker for Daily Summary Pipeline started.');
  }
}

export class WeeklySummaryPipelineJob {
  static generateWeeklySummaryForUser(userId: string, anchorDate = new Date(), force = false) {
    return generateSummaryForUser(userId, 'weekly', anchorDate, force);
  }

  static startCron() {
    const summaryTimeZone = resolveSummaryTimeZone();
    cron.schedule('55 23 * * 0', async () => {
      console.log(`[Cron] Triggering Weekly Summary pipeline (Sunday 23:55 ${summaryTimeZone})`);
      await runForAllUsers('weekly');
    }, { timezone: summaryTimeZone });
    console.log('Background Worker for Weekly Summary Pipeline started.');
  }
}

export class MonthlySummaryPipelineJob {
  static generateMonthlySummaryForUser(userId: string, anchorDate = new Date(), force = false) {
    return generateSummaryForUser(userId, 'monthly', anchorDate, force);
  }

  static startCron() {
    const summaryTimeZone = resolveSummaryTimeZone();
    cron.schedule('58 23 28-31 * *', async () => {
      const now = new Date();
      if (!isLastLocalDayOfMonth(now, summaryTimeZone)) return;

      console.log(
        `[Cron] Triggering Monthly Summary pipeline (last local day of month, 23:58 ${summaryTimeZone})`,
      );
      await runForAllUsers('monthly', now);
    }, { timezone: summaryTimeZone });
    console.log('Background Worker for Monthly Summary Pipeline started.');
  }
}

export class YearlySummaryPipelineJob {
  static generateYearlySummaryForUser(userId: string, anchorDate = new Date(), force = false) {
    return generateSummaryForUser(userId, 'yearly', anchorDate, force);
  }

  static startCron() {
    const summaryTimeZone = resolveSummaryTimeZone();
    cron.schedule('59 23 31 12 *', async () => {
      console.log(`[Cron] Triggering Yearly Summary pipeline (Dec 31 23:59 ${summaryTimeZone})`);
      await runForAllUsers('yearly');
    }, { timezone: summaryTimeZone });
    console.log('Background Worker for Yearly Summary Pipeline started.');
  }
}

import { prisma } from '../../lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cron from 'node-cron';

export class SummaryPipelineJob {


  private static async callAI(context: string): Promise<string> {
    return generateReflectionSummary({
      context,
      period: 'daily',
      instruction:
        'Create a concise daily log. Include key events, diary reflections, calendar context, and concrete follow-ups if present.',
    });
  }

  static async generateDailySummaryForUser(userId: string) {
    console.log(`[Worker - Summary] Starting daily summary generation for User ID: ${userId}`);

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const diaries = await prisma.diaryEntry.findMany({
        where: { user_id: userId, created_at: { gte: startOfDay, lte: endOfDay } }
      });

      const events = await prisma.calendarEvent.findMany({
        where: { user_id: userId, start_time: { gte: startOfDay, lte: endOfDay } }
      });

      if (diaries.length === 0 && events.length === 0) {
        console.log(`[Worker - Summary] User ${userId} has no activity today. Skipping.`);
        return;
      }

      let combinedContext = `Here are my activities for ${today.toDateString()}:\n\n`;

      if (events.length > 0) {
        combinedContext += "CALENDAR EVENTS:\n";
        events.forEach((e: { title: string; start_time: Date; end_time: Date }) => {
          combinedContext += `- ${e.title} (from ${e.start_time.getHours()}:${e.start_time.getMinutes()} to ${e.end_time.getHours()}:${e.end_time.getMinutes()})\n`;
        });
        combinedContext += "\n";
      }

      if (diaries.length > 0) {
        combinedContext += "DIARY ENTRIES:\n";
        diaries.forEach((d: { raw_text: string }) => {
          combinedContext += `- ${d.raw_text}\n`;
        });
      }

      console.log(`[Worker - Summary] Sending context to AI...`);
      const aiSummaryText = await this.callAI(combinedContext);

      await prisma.$transaction([
        prisma.summary.deleteMany({
          where: {
            user_id: userId,
            summary_type: 'daily',
            period_start: startOfDay,
            period_end: endOfDay,
          },
        }),
        prisma.summary.create({
          data: {
            user_id: userId,
            summary_type: 'daily',
            period_start: startOfDay,
            period_end: endOfDay,
            content: aiSummaryText
          }
        }),
      ]);

      await prisma.$executeRaw`
        UPDATE memory_chunks
        SET metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{dailySummaryPeriod}',
          ${JSON.stringify({ start: startOfDay.toISOString(), end: endOfDay.toISOString() })}::jsonb,
          true
        ),
        updated_at = now()
        WHERE user_id = ${userId}
          AND source_type = 'diary'
          AND occurred_at >= ${startOfDay}
          AND occurred_at <= ${endOfDay}
      `;

      console.log(`[Worker - Summary] Successfully generated Daily Summary for User ID: ${userId}`);

    } catch (error) {
      console.error(`[Worker - Summary] Pipeline process error:`, error);
    }
  }

  static startCron() {
    cron.schedule('50 23 * * *', async () => {
      console.log('[Cron] Triggering Daily Summary pipeline (23:50)');

      const users = await prisma.user.findMany({ select: { id: true } });

      for (const user of users) {
        await this.generateDailySummaryForUser(user.id);
      }
    });

    console.log('Background Worker for Daily Summary Pipeline started.');
  }
}


export class WeeklySummaryPipelineJob {

  private static async callAIForWeekly(context: string): Promise<string> {
    return generateReflectionSummary({
      context,
      period: 'weekly',
      instruction:
        'Create a weekly review from the daily logs. Summarize major themes, progress, blockers, notable events, and next-week follow-ups.',
    });
  }

  static async generateWeeklySummaryForUser(userId: string) {
    console.log(`[Worker - Weekly Summary] Starting weekly summary generation for User ID: ${userId}`);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(now);
    endOfWeek.setHours(23, 59, 59, 999);

    try {
      const dailySummaries = await prisma.summary.findMany({
        where: {
          user_id: userId,
          summary_type: 'daily',
          period_start: { gte: sevenDaysAgo },
          period_end: { lte: endOfWeek }
        },
        orderBy: { period_start: 'asc' }
      });

      if (dailySummaries.length === 0) {
        console.log(`[Worker - Weekly Summary] User ${userId} has no daily summaries this week. Skipping.`);
        return;
      }

      let weeklyContext = `Here are my daily summaries for the past week:\n\n`;
      dailySummaries.forEach((ds) => {
        weeklyContext += `Date: ${ds.period_start.toDateString()}\nSummary: ${ds.content}\n\n`;
      });

      console.log(`[Worker - Weekly Summary] Sending weekly context to AI...`);
      const aiWeeklySummaryText = await this.callAIForWeekly(weeklyContext);

      await prisma.$transaction([
        prisma.summary.deleteMany({
          where: {
            user_id: userId,
            summary_type: 'weekly',
            period_start: sevenDaysAgo,
            period_end: endOfWeek,
          },
        }),
        prisma.summary.create({
          data: {
            user_id: userId,
            summary_type: 'weekly',
            period_start: sevenDaysAgo,
            period_end: endOfWeek,
            content: aiWeeklySummaryText
          }
        }),
      ]);

      console.log(`[Worker - Weekly Summary] Successfully generated Weekly Summary for User ID: ${userId}`);

    } catch (error) {
      console.error(`[Worker - Weekly Summary] Pipeline process error:`, error);
    }
  }

  static startCron() {
    cron.schedule('55 23 * * 0', async () => {
      console.log('[Cron] Triggering Weekly Summary pipeline (Sunday 23:55)');

      const users = await prisma.user.findMany({ select: { id: true } });

      for (const user of users) {
        await this.generateWeeklySummaryForUser(user.id);
      }
    });

    console.log('Background Worker for Weekly Summary Pipeline started.');
  }
}

async function generateReflectionSummary(input: {
  context: string;
  period: 'daily' | 'weekly';
  instruction: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for summary generation.');
  }

  const modelName = process.env.GEMINI_SUMMARY_MODEL ?? 'gemini-2.5-flash';
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
    },
  });

  const prompt = `
You are the reflection writer for a personal Second Brain diary system.

Task:
${input.instruction}

Rules:
- Use only the provided context.
- Do not invent people, events, dates, or outcomes.
- If the context is thin, say so briefly.
- Keep the response in clear Markdown.
- Write in the same language as the source context when possible.

Context:
${input.context}
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) {
    throw new Error(`Gemini returned an empty ${input.period} summary.`);
  }

  return text;
}

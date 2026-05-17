import { prisma } from '../../lib/prisma';
import * as cron from 'node-cron';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class SummaryPipelineJob {

  private static async callAI(context: string): Promise<string> {
    console.log(`[Worker - AI] Connecting to Gemini API for daily summary...`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing in environment variables.");
    }

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_ANSWER_MODEL ?? "gemini-2.5-flash" });

    const prompt = `
    You are an AI assistant for a personal Second Brain system.
    Generate a concise, encouraging daily summary based on the provided activities and diary entries.
    Do not invent any events. Highlight key accomplishments or mood if apparent.
    Respond in English.

    Context for today:
    ${context}
    `;

    try {
      const result = await model.generateContent(prompt);
      const summary = result.response.text();
      console.log(`[Worker - AI] Daily summary generated successfully!`);
      return summary;
    } catch (error: any) {
      console.error(`[Worker - AI] Gemini API Error:`, error.message);
      return "The AI ​​system is temporarily unable to generate summaries today.";
    }
  }

  static async generateDailySummaryForUser(userId: string) {
    console.log(`[Worker - Summary] Starting daily summary generation for User ID: ${userId}`);

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

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

      let combinedContext = `Activities for ${today.toDateString()}:\n\n`;

      if (events.length > 0) {
        combinedContext += "CALENDAR EVENTS:\n";
        events.forEach((e: any) => {
          combinedContext += `- ${e.title} (from ${e.start_time.getHours()}:${e.start_time.getMinutes()} to ${e.end_time.getHours()}:${e.end_time.getMinutes()})\n`;
        });
        combinedContext += "\n";
      }

      if (diaries.length > 0) {
        combinedContext += "DIARY ENTRIES:\n";
        diaries.forEach((d: any) => {
          combinedContext += `- ${d.raw_text}\n`;
        });
      }

      const aiSummaryText = await this.callAI(combinedContext);

      await prisma.summary.create({
        data: {
          user_id: userId,
          summary_type: 'daily',
          period_start: startOfDay,
          period_end: endOfDay,
          content: aiSummaryText
        }
      });

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
    console.log(`[Worker - AI] Connecting to Gemini API for weekly summary...`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing in environment variables.");

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_ANSWER_MODEL ?? "gemini-2.5-flash" });

    const prompt = `
    You are an AI assistant for a personal Second Brain system.
    Generate a comprehensive weekly review based on the 7 daily summaries provided.
    Identify patterns, overall productivity, and general well-being throughout the week.
    Respond in English.

    Weekly Context:
    ${context}
    `;

    try {
      const result = await model.generateContent(prompt);
      const summary = result.response.text();
      console.log(`[Worker - AI] Weekly summary generated successfully!`);
      return summary;
    } catch (error: any) {
      console.error(`[Worker - AI] Gemini API Error:`, error.message);
      return "The AI ​​system is temporarily unable to generate a weekly summary.";
    }
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

      let weeklyContext = `Here are the daily summaries for the past week:\n\n`;
      dailySummaries.forEach((ds: any) => {
        weeklyContext += `Date: ${ds.period_start.toDateString()}\nSummary: ${ds.content}\n\n`;
      });

      const aiWeeklySummaryText = await this.callAIForWeekly(weeklyContext);

      await prisma.summary.create({
        data: {
          user_id: userId,
          summary_type: 'weekly',
          period_start: sevenDaysAgo,
          period_end: endOfWeek,
          content: aiWeeklySummaryText
        }
      });

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

export class MonthlySummaryPipelineJob {

  private static async callAIForMonthly(context: string): Promise<string> {
    console.log(`[Worker - AI] Connecting to Gemini API for monthly summary...`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing in environment variables.");

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_ANSWER_MODEL ?? "gemini-2.5-flash" });

    const prompt = `
    You are an AI assistant for a personal Second Brain system.
    Generate a comprehensive monthly reflection based on the weekly summaries provided.

    Your monthly reflection should:
    1. Identify overarching themes and patterns across the entire month.
    2. Highlight the most significant accomplishments and milestones.
    3. Note any recurring challenges or areas of concern.
    4. Observe trends in productivity, mood, and well-being.
    5. Provide 2-3 actionable suggestions for the next month based on the patterns observed.

    Do not invent any events or details not present in the weekly summaries.
    Respond in English.

    Monthly Context (Weekly Summaries):
    ${context}
    `;

    try {
      const result = await model.generateContent(prompt);
      const summary = result.response.text();
      console.log(`[Worker - AI] Monthly summary generated successfully!`);
      return summary;
    } catch (error: any) {
      console.error(`[Worker - AI] Gemini API Error:`, error.message);
      return "The AI system is temporarily unable to generate a monthly summary.";
    }
  }

  static async generateMonthlySummaryForUser(userId: string) {
    console.log(`[Worker - Monthly Summary] Starting monthly summary generation for User ID: ${userId}`);

    const now = new Date();
    // Start of the current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now);
    endOfMonth.setHours(23, 59, 59, 999);

    try {
      const weeklySummaries = await prisma.summary.findMany({
        where: {
          user_id: userId,
          summary_type: 'weekly',
          period_start: { gte: startOfMonth },
          period_end: { lte: endOfMonth }
        },
        orderBy: { period_start: 'asc' }
      });

      if (weeklySummaries.length === 0) {
        console.log(`[Worker - Monthly Summary] User ${userId} has no weekly summaries this month. Skipping.`);
        return;
      }

      let monthlyContext = `Here are the weekly summaries for ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}:\n\n`;
      weeklySummaries.forEach((ws: any, index: number) => {
        monthlyContext += `Week ${index + 1} (${ws.period_start.toDateString()} – ${ws.period_end.toDateString()}):\n${ws.content}\n\n`;
      });

      const aiMonthlySummaryText = await this.callAIForMonthly(monthlyContext);

      await prisma.summary.create({
        data: {
          user_id: userId,
          summary_type: 'monthly',
          period_start: startOfMonth,
          period_end: endOfMonth,
          content: aiMonthlySummaryText
        }
      });

      console.log(`[Worker - Monthly Summary] Successfully generated Monthly Summary for User ID: ${userId}`);

    } catch (error) {
      console.error(`[Worker - Monthly Summary] Pipeline process error:`, error);
    }
  }

  static startCron() {
    // Run on the last day of each month at 23:58
    // Cron expression: minute 58, hour 23, days 28-31 (with month-end check in handler)
    cron.schedule('58 23 28-31 * *', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      // Only run if tomorrow is the 1st (i.e., today is actually the last day of the month)
      if (tomorrow.getDate() !== 1) return;

      console.log('[Cron] Triggering Monthly Summary pipeline (last day of month, 23:58)');
      const users = await prisma.user.findMany({ select: { id: true } });
      for (const user of users) {
        await this.generateMonthlySummaryForUser(user.id);
      }
    });
    console.log('Background Worker for Monthly Summary Pipeline started.');
  }
}
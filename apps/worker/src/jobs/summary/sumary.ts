import { prisma } from '../../lib/prisma';
import * as cron from 'node-cron';

export class SummaryPipelineJob {


  private static async callAI(context: string): Promise<string> {
    console.log(`[Mock AI] Receiving context of ${context.length} characters. Starting analysis...`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const activityCount = (context.match(/-/g) || []).length;

    let mood = "Normal";
    if (activityCount > 5) mood = "Extremely busy and productive";
    else if (activityCount > 2) mood = "Focused and efficient";

    const mockSummary = `[MOCK SUMMARY FOR DEV]
    Today was a ${mood.toLowerCase()} day. The system has recorded a total of ${activityCount} activities and notes.

    Key highlights:
    - You closely followed your scheduled events for the day.
    - Your diary entries indicate you are staying on track with your tasks.

    (Note: This is mock data from the Workflow Team to test the Pipeline. Ready for Tam to plug in the Gemini API!)`;

    console.log(`[Mock AI] Analysis complete!`);
    return mockSummary;
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
    console.log(`[Mock AI - Weekly] Receiving context of ${context.length} characters. Starting weekly analysis...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    const mockWeeklySummary = `[WEEKLY MOCK SUMMARY FOR DEV]
    This week has been productive. You have maintained a consistent streak of daily reflections.
    
    Key Weekly Insights:
    - You successfully completed most of your planned calendar events.
    - Your daily mood has been generally positive and focused.
    
    (Note: Awaiting AI Lead to integrate the actual Gemini reasoning engine for deeper weekly insights.)`;

    console.log(`[Mock AI - Weekly] Analysis complete!`);
    return mockWeeklySummary;
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
    cron.schedule('55 23 * * *', async () => {
      console.log('[Cron] Triggering Weekly Summary pipeline (Sunday 23:55)');

      const users = await prisma.user.findMany({ select: { id: true } });

      for (const user of users) {
        await this.generateWeeklySummaryForUser(user.id);
      }
    });

    console.log('Background Worker for Weekly Summary Pipeline started.');
  }
}
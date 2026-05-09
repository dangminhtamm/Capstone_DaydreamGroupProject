import { prisma } from '../../lib/prisma';
import * as cron from 'node-cron';

export class SemanticLinkingJob {

  private static extractKeywords(text: string): string[] {
    if (!text) return [];
    const stopWords = ['là', 'và', 'của', 'ở', 'trong', 'với', 'cho', 'có', 'thì', 'mà'];
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 2 && !stopWords.includes(word));
  }

  static async processDiaryLinking(diary: any) {
    try {
      const startOfDay = new Date(diary.created_at);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(diary.created_at);
      endOfDay.setHours(23, 59, 59, 999);

      const dailyEvents = await prisma.calendarEvent.findMany({
        where: {
          user_id: diary.user_id,
          start_time: { gte: startOfDay, lte: endOfDay },
        },
      });

      if (dailyEvents.length === 0) return;

      const diaryKeywords = this.extractKeywords(diary.raw_text);
      const linkedEventIds = [];

      for (const event of dailyEvents) {
        let matchScore = 0;

        const timeDiffHours = Math.abs(diary.created_at.getTime() - event.end_time.getTime()) / (1000 * 60 * 60);
        if (timeDiffHours <= 1) matchScore += 50;
        else if (timeDiffHours <= 3) matchScore += 30;
        else if (timeDiffHours <= 12) matchScore += 10;

        const eventKeywords = this.extractKeywords(`${event.title} ${event.description || ''}`);
        const matchedWords = eventKeywords.filter((k) => diaryKeywords.includes(k));

        if (matchedWords.length > 0) {
          matchScore += matchedWords.length * 15;
        }

        if (matchScore >= 40) {
          linkedEventIds.push(event.id);
        }
      }

      // CONNECT TO DATABASE
      if (linkedEventIds.length > 0) {
        await prisma.diaryEntry.update({
          where: { id: diary.id },
          data: {
            calendar_events: {
              connect: linkedEventIds.map((id) => ({ id })),
            },
          },
        });
        console.log(`[Worker - Semantic Link] Success! Linked ${linkedEventIds.length} events to Diary [${diary.id}].`);
      }

    } catch (error: any) {
      console.error(`[Worker - Semantic Link] Execution error for Diary [${diary.id}]:`, error.message);
    }
  }

  static startCron() {
    cron.schedule('*/15 * * * *', async () => {
      console.log('[Cron] Triggering Semantic Linking Scan');

      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);


        const unlinkedDiaries = await prisma.diaryEntry.findMany({
          where: {
            created_at: { gte: twentyFourHoursAgo },
            calendar_events: {
              none: {}
            }
          }
        });

        if (unlinkedDiaries.length === 0) {
          console.log('[Worker - Semantic Link] No unlinked diaries found. Skipping.');
          return;
        }

        console.log(`[Worker - Semantic Link] Found ${unlinkedDiaries.length} unlinked diaries. Processing...`);

        for (const diary of unlinkedDiaries) {
          await this.processDiaryLinking(diary);
        }

      } catch (error: any) {
        console.error(`[Worker - Semantic Link] Cron processing error:`, error.message);
      }
    });

    console.log('Background Worker for Semantic Linking started.');
  }
}
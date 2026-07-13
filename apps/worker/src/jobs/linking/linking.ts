import { prisma } from '../../lib/prisma';
import * as cron from 'node-cron';
import { extractKeywords } from './linking-utils';

export class SemanticLinkingJob {
  static async processDiaryLinking(diary: any) {
    try {
      const activityDate = diary.entry_date ?? diary.created_at;
      const startOfDay = new Date(activityDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(activityDate);
      endOfDay.setHours(23, 59, 59, 999);

      const dailyEvents = await prisma.calendarEvent.findMany({
        where: {
          user_id: diary.user_id,
          start_time: { gte: startOfDay, lte: endOfDay },
        },
      });

      if (dailyEvents.length === 0) return;

      const diaryKeywords = extractKeywords(diary.raw_text);
      const linkedEvents = [];

      for (const event of dailyEvents) {
        let matchScore = 0;

        const timeDiffHours = Math.abs(new Date(activityDate).getTime() - event.end_time.getTime()) / (1000 * 60 * 60);
        if (timeDiffHours <= 1) matchScore += 50;
        else if (timeDiffHours <= 3) matchScore += 30;
        else if (timeDiffHours <= 12) matchScore += 10;

        const eventKeywords = extractKeywords(`${event.title} ${event.description || ''}`);
        const matchedWords = eventKeywords.filter((k) => diaryKeywords.includes(k));

        if (matchedWords.length > 0) {
          matchScore += matchedWords.length * 15;
        }

        if (matchScore >= 40) {
          linkedEvents.push(event);
        }
      }

      // CONNECT TO DATABASE
      if (linkedEvents.length > 0) {
        const linkedEventIds = linkedEvents.map((event) => event.id);
        const memoryEventContext = linkedEvents.map((event) => ({
          id: event.id,
          title: event.title,
          startTime: event.start_time.toISOString(),
          endTime: event.end_time.toISOString(),
        }));

        await prisma.diaryEntry.update({
          where: { id: diary.id },
          data: {
            calendar_events: {
              connect: linkedEventIds.map((id) => ({ id })),
            },
          },
        });

        await prisma.$executeRaw`
          UPDATE memory_chunks
          SET metadata = jsonb_set(
            jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{calendarEventIds}',
              ${JSON.stringify(linkedEventIds)}::jsonb,
              true
            ),
            '{calendarEvents}',
            ${JSON.stringify(memoryEventContext)}::jsonb,
            true
          ),
          updated_at = now()
          WHERE user_id = ${diary.user_id}
            AND source_type = 'diary'
            AND source_id = ${diary.id}
        `;

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

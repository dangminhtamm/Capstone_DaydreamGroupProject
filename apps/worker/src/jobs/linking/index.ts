import { prisma } from '@second-brain/db';

export class LinkingJob {

  private static extractKeywords(text: string): string[] {
    if (!text) return [];
    const stopWords = ['là', 'và', 'của', 'ở', 'trong', 'với', 'cho', 'có', 'thì', 'mà'];
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 2 && !stopWords.includes(word));
  }

  static async processDiaryLinking(diaryId: string, userId: string) {
    console.log(`[Worker - LinkingJob] Starting data scan for Diary ID: ${diaryId}`);

    try {
      const diary = await prisma.diaryEntry.findUnique({
        where: { id: diaryId }
      });

      if (!diary) {
        console.error(`[Worker] Diary entry ${diaryId} not found.`);
        return;
      }

      const startOfDay = new Date(diary.created_at);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(diary.created_at);
      endOfDay.setHours(23, 59, 59, 999);

      const dailyEvents = await prisma.calendarEvent.findMany({
        where: {
          user_id: userId,
          start_time: { gte: startOfDay, lte: endOfDay },
        },
      });

      if (dailyEvents.length === 0) {
        console.log(`[Worker] No calendar events found for ${startOfDay.toDateString()}.`);
        return;
      }

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

      if (linkedEventIds.length > 0) {
        await prisma.diaryEntry.update({
          where: { id: diaryId },
          data: {
            calendar_events: {
              connect: linkedEventIds.map((id) => ({ id })),
            },
          },
        });
        console.log(`[Worker - LinkingJob] Success! Linked ${linkedEventIds.length} events to the diary entry.`);
      } else {
        console.log(`[Worker - LinkingJob] No events met the scoring threshold for linking.`);
      }

    } catch (error) {
      console.error(`[Worker - LinkingJob] Execution error:`, error);
    }
  }
}
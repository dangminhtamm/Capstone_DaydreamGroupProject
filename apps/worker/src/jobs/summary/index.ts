import { prisma } from '../../lib/prisma';
import * as cron from 'node-cron';

export class SummaryPipelineJob {

  // 1. MOCK AI FUNCTION (Được quản lý bởi AI Lead - Đặng Minh Tâm)
  // TODO: @Tam - Replace this mock function with the actual Tuturuuu Gateway / Gemini integration
  private static async callAI(context: string): Promise<string> {
    console.log(`[Mock AI] Đang nhận context dài ${context.length} ký tự. Bắt đầu phân tích...`);

    // Giả lập độ trễ (latency) của mạng khi gọi API Google Gemini (khoảng 3 giây)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Thuật toán giả lập: Đếm lướt xem hôm nay user có bao nhiêu gạch đầu dòng (-)
    const activityCount = (context.match(/-/g) || []).length;

    // Tự động phân tích ngữ cảnh (giả lập)
    let mood = "Bình thường";
    if (activityCount > 5) mood = "Cực kỳ bận rộn và năng suất";
    else if (activityCount > 2) mood = "Tập trung và hiệu quả";

    const mockSummary = `[BẢN TÓM TẮT MOCK CHO DEV]
    Hôm nay là một ngày ${mood.toLowerCase()}. Hệ thống đã ghi nhận tổng cộng ${activityCount} hoạt động và ghi chú của bạn.

    Các điểm nhấn chính:
    - Bạn đã theo sát các lịch trình được đề ra trong ngày.
    - Các bài nhật ký cho thấy bạn đang bám sát tiến độ công việc.

    (Lưu ý: Đây là dữ liệu giả lập từ Workflow Team để test Pipeline. Chờ Tâm cắm Gemini API vào là đẹp!)`;

    console.log(`[Mock AI] Phân tích hoàn tất!`);
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

    console.log('Background Worker for Summary Pipeline started.');
  }
}
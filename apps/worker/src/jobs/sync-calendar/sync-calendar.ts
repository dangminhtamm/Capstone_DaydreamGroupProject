import { prisma } from '../../lib/prisma';
import { google, calendar_v3 } from 'googleapis';
import * as cron from 'node-cron';

export class SyncCalendarJob {

  // Helper to normalize Google Calendar data to our Schema
  private static normalizeEvent(googleEvent: calendar_v3.Schema$Event, userId: string) {
    const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
    const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;

    return {
      external_id: googleEvent.id as string,
      user_id: userId,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description || null,
      start_time: startTime ? new Date(startTime) : new Date(),
      end_time: endTime ? new Date(endTime) : new Date(),
      html_link: googleEvent.htmlLink || null,
    };
  }

  // Core logic to sync events for a specific user
  static async syncEventsForUser(user: any) {
    if (!user.google_access_token) {
      console.log(`[Worker - Calendar Sync] Skipping User ${user.id}: No Google token found.`);
      return;
    }

    console.log(`[Worker - Calendar Sync] Starting background sync for User ID: ${user.id}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token,
    });
    oauth2Client.on('tokens', async (tokens) => {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(tokens.access_token && { google_access_token: tokens.access_token }),
          ...(tokens.refresh_token && { google_refresh_token: tokens.refresh_token }),
        },
      });
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30); // Sync past 30 days
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 60); // Sync future 60 days

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const rawEvents = response.data.items || [];

      const upsertPromises = rawEvents.map((event) => {
        const normalizedData = this.normalizeEvent(event, user.id);

        return prisma.calendarEvent.upsert({
          where: { external_id: normalizedData.external_id },
          update: {
            title: normalizedData.title,
            description: normalizedData.description,
            start_time: normalizedData.start_time,
            end_time: normalizedData.end_time,
            html_link: normalizedData.html_link,
          },
          create: {
            external_id: normalizedData.external_id,
            user_id: normalizedData.user_id,
            title: normalizedData.title,
            description: normalizedData.description,
            start_time: normalizedData.start_time,
            end_time: normalizedData.end_time,
            html_link: normalizedData.html_link,
          },
        });
      });

      await Promise.all(upsertPromises);
      console.log(`[Worker - Calendar Sync] Success: Synced ${rawEvents.length} events for User ${user.id}`);

    } catch (error: any) {
      console.error(`[Worker - Calendar Sync] Error for User ${user.id}: ${error.message}`);
    }
  }

  // Initialize the Background Cron Job
  static startCron() {
    // Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00)
    cron.schedule('0 */6 * * *', async () => {
      console.log('[Cron] Triggering Automated Google Calendar Sync');

      // Only fetch users who have connected their Google account
      const usersToSync = await prisma.user.findMany({
        where: {
          google_access_token: { not: null }
        }
      });

      console.log(`[Worker - Calendar Sync] Found ${usersToSync.length} eligible users for sync.`);

      for (const user of usersToSync) {
        await this.syncEventsForUser(user);
      }
    });

    console.log('Background Worker for Auto-Sync Calendar started.');
  }
}

import { prisma } from '../../lib/prisma';
import { google, calendar_v3 } from 'googleapis';
import * as cron from 'node-cron';
import { encryptOAuthToken, decryptOAuthToken } from '@second-brain/shared';

type GoogleSource = 'calendar' | 'gmail' | 'drive' | 'contact';

export class SyncCalendarJob {
  private static getApiBaseUrl() {
    return process.env.API_PUBLIC_URL || process.env.API_URL || 'http://localhost:3001';
  }

  private static getRedirectUri() {
    return (
      process.env.GOOGLE_REDIRECT_URI ||
      `${this.getApiBaseUrl().replace(/\/$/, '')}/api/calendar/oauth/callback`
    );
  }


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
    if (!user.google_access_token && !user.google_refresh_token) {
      console.log(`[Worker - Calendar Sync] Skipping User ${user.id}: No Google token found.`);
      return;
    }

    console.log(`[Worker - Calendar Sync] Starting background sync for User ID: ${user.id}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      this.getRedirectUri(),
    );

    oauth2Client.setCredentials({
      access_token: decryptOAuthToken(user.google_access_token),
      refresh_token: decryptOAuthToken(user.google_refresh_token),
    });
    oauth2Client.on('tokens', async (tokens) => {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(tokens.access_token && { google_access_token: encryptOAuthToken(tokens.access_token) }),
          ...(tokens.refresh_token && { google_refresh_token: encryptOAuthToken(tokens.refresh_token) }),
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
        showDeleted: true,
        orderBy: 'startTime',
      });

      const rawEvents = response.data.items || [];

      const syncedEvents = await prisma.$transaction(async (tx) => {
        const events = [];

        for (const event of rawEvents) {

          if (event.status === 'cancelled') {
            await tx.calendarEvent.deleteMany({
              where: {
                external_id: event.id as string,
                user_id: user.id,
              },
            });
            console.log(`Cancelled event removed from Google Calendar: [${event.id}]`);
            continue;
          }
          const normalizedData = this.normalizeEvent(event, user.id);
          const syncedEvent = await tx.calendarEvent.upsert({
            where: {
              user_id_external_id: {
                user_id: normalizedData.user_id,
                external_id: normalizedData.external_id,
              },
            },
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

          await this.enqueueCalendarIndexingJob(tx, {
            userId: user.id,
            calendarEventId: syncedEvent.id,
            externalId: syncedEvent.external_id,
            title: syncedEvent.title,
          });

          events.push(syncedEvent);
        }

        return events;
      });
      console.log(
        `[Worker - Calendar Sync] Success: Synced ${rawEvents.length} events and queued ${syncedEvents.length} indexing jobs for User ${user.id}`,
      );
      await this.recordGoogleSyncSuccess(user.id, 'calendar');

    } catch (error: any) {
      await this.recordGoogleSyncFailure(user.id, 'calendar', error);
      console.error(`[Worker - Calendar Sync] Error for User ${user.id}: ${this.toErrorMessage(error)}`);
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
          OR: [
            { google_access_token: { not: null } },
            { google_refresh_token: { not: null } },
          ],
        },
      });

      console.log(`[Worker - Calendar Sync] Found ${usersToSync.length} eligible users for sync.`);

      for (const user of usersToSync) {
        await this.syncEventsForUser(user);
      }
    });

    console.log('Background Worker for Auto-Sync Calendar started.');
  }

  private static async enqueueCalendarIndexingJob(
    tx: any,
    input: {
      userId: string;
      calendarEventId: string;
      externalId: string;
      title: string;
    },
  ) {
    return tx.indexingOutbox.upsert({
      where: {
        job_type_source_type_source_id: {
          job_type: 'index_memory',
          source_type: 'calendar',
          source_id: input.calendarEventId,
        },
      },
      update: {
        user_id: input.userId,
        status: 'pending',
        retry_count: 0,
        error: null,
        payload: {
          externalId: input.externalId,
          sourceTitle: input.title,
        },
        run_after: new Date(),
        locked_at: null,
        locked_by: null,
        processed_at: null,
      },
      create: {
        user_id: input.userId,
        job_type: 'index_memory',
        source_type: 'calendar',
        source_id: input.calendarEventId,
        status: 'pending',
        payload: {
          externalId: input.externalId,
          sourceTitle: input.title,
        },
      },
    });
  }

  private static async recordGoogleSyncSuccess(userId: string, source: GoogleSource) {
    await this.upsertGoogleConnection({
      userId,
      source,
      connected: true,
      lastSyncAt: new Date(),
      lastError: null,
    });
  }

  private static async recordGoogleSyncFailure(userId: string, source: GoogleSource, error: unknown) {
    const message = this.toErrorMessage(error);
    const reconnectRequired = this.isGoogleReconnectRequiredError(message);

    await this.upsertGoogleConnection({
      userId,
      source,
      connected: !reconnectRequired,
      lastSyncAt: null,
      lastError: reconnectRequired ? `Needs reconnect: ${message}` : message,
    });
  }

  private static async upsertGoogleConnection(input: {
    userId: string;
    source: GoogleSource;
    connected: boolean;
    lastSyncAt: Date | null;
    lastError: string | null;
  }) {
    try {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO google_connections (
          user_id,
          source,
          connected,
          scopes,
          last_sync_at,
          last_error,
          last_error_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          CASE WHEN $6 IS NULL THEN NULL ELSE now() END
        )
        ON CONFLICT (user_id, source) DO UPDATE SET
          connected = EXCLUDED.connected,
          scopes = EXCLUDED.scopes,
          last_sync_at = COALESCE(EXCLUDED.last_sync_at, google_connections.last_sync_at),
          last_error = EXCLUDED.last_error,
          last_error_at = CASE WHEN EXCLUDED.last_error IS NULL THEN NULL ELSE now() END,
          updated_at = now()
        `,
        input.userId,
        input.source,
        input.connected,
        this.getGoogleSourceScopes(input.source),
        input.lastSyncAt,
        input.lastError?.slice(0, 1000) ?? null,
      );
    } catch (error) {
      console.warn(`[Worker - Calendar Sync] Could not update google_connections for ${input.source}: ${this.toErrorMessage(error)}`);
    }
  }

  private static getGoogleSourceScopes(source: GoogleSource) {
    const scopes: Record<GoogleSource, string[]> = {
      calendar: ['https://www.googleapis.com/auth/calendar.readonly'],
      gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
      drive: ['https://www.googleapis.com/auth/drive.readonly'],
      contact: ['https://www.googleapis.com/auth/contacts.readonly'],
    };

    return scopes[source];
  }

  private static isGoogleReconnectRequiredError(message: string) {
    const normalized = message.toLowerCase();

    return (
      /\binvalid_grant\b/i.test(message) ||
      /\binvalid_credentials\b/i.test(message) ||
      normalized.includes('invalid credentials') ||
      normalized.includes('token has been expired') ||
      normalized.includes('token has been revoked') ||
      normalized.includes('token expired') ||
      normalized.includes('unauthorized') ||
      normalized.includes('401') ||
      normalized.includes('insufficient authentication scopes') ||
      normalized.includes('insufficient permission') ||
      normalized.includes('insufficient permissions') ||
      normalized.includes('insufficient scope') ||
      normalized.includes('insufficient_scope') ||
      normalized.includes('forbidden') && (
        normalized.includes('scope') ||
        normalized.includes('permission')
      )
    );
  }

  private static toErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error) {
      const record = error as Record<string, unknown>;
      return [
        record.code,
        record.status,
        record.message,
        record.response ? JSON.stringify(record.response) : null,
        record.errors ? JSON.stringify(record.errors) : null,
      ].filter(Boolean).join(' ') || 'Unknown Google Calendar sync error';
    }

    return String(error);
  }
}

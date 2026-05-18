import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import {
  indexMemoryFromCalendar,
  type CalendarEventInput,
} from '@second-brain/ai';
import { insertMemoryChunks } from '@second-brain/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalizeEvent(
    googleEvent: calendar_v3.Schema$Event,
    userId: string,
  ) {
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

  async syncGoogleEvents(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
    });

    if (!user || !user.google_access_token) {
      throw new UnauthorizedException(
        'User has not connected Google Calendar.',
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token,
    });
    oauth2Client.on('tokens', async (tokens) => {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(tokens.access_token && {
            google_access_token: tokens.access_token,
          }),
          ...(tokens.refresh_token && {
            google_refresh_token: tokens.refresh_token,
          }),
        },
      });
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);

      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 60);

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const rawEvents = response.data.items || [];

      // Step 1: Upsert calendar events into DB
      const upsertedEvents: Array<{
        id: string;
        external_id: string;
        title: string;
        description: string | null;
        start_time: Date;
        end_time: Date;
        html_link: string | null;
      }> = [];

      for (const event of rawEvents) {
        const normalizedData = this.normalizeEvent(event, user.id);
        const upserted = await this.prisma.calendarEvent.upsert({
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
        upsertedEvents.push(upserted);
      }

      // Step 2: Index events into AI memory
      const memoryResult = await this.indexCalendarEventsToMemory(
        user.id,
        upsertedEvents,
      );

      return {
        message: 'Sync completed successfully',
        syncedCount: rawEvents.length,
        memoryIndexed: memoryResult.indexedEventCount,
        memoryErrors: memoryResult.errors.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync Google Calendar for user ${user.id}: ${
          error instanceof Error ? error.message : error
        }`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Could not sync Google Calendar right now. Please try again shortly.',
      );
    }
  }

  async getEventsFromDb(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 60);

    return await this.prisma.calendarEvent.findMany({
      where: {
        user_id: user.id,
        start_time: { gte: timeMin, lte: timeMax },
      },
      orderBy: {
        start_time: 'asc',
      },
      take: 20,
    });
  }

  // -----------------------------------------------------------------------
  // AI Memory Indexing for Calendar Events
  // -----------------------------------------------------------------------

  /**
   * Index calendar events into memory_chunks for AI retrieval.
   * Each event produces 1–2 chunks (summary + optional description).
   * Calendar events are already structured, so no LLM chunking needed.
   */
  private async indexCalendarEventsToMemory(
    userId: string,
    events: Array<{
      id: string;
      external_id: string;
      title: string;
      description: string | null;
      start_time: Date;
      end_time: Date;
      html_link: string | null;
    }>,
  ) {
    const calendarInputs: CalendarEventInput[] = events.map((event) => ({
      eventId: event.id,
      externalId: event.external_id,
      title: event.title,
      description: event.description,
      startTime: event.start_time,
      endTime: event.end_time,
      htmlLink: event.html_link,
    }));

    try {
      return await indexMemoryFromCalendar({
        userId,
        events: calendarInputs,
        insertChunks: async (chunks) => {
          await this.prisma.$transaction(async (tx) => {
            await insertMemoryChunks(tx as any, chunks);
          });
        },
      });
    } catch (error) {
      console.error(
        '[CalendarService] Memory indexing failed (non-fatal):',
        error,
      );
      return {
        sourceType: 'calendar' as const,
        indexedEventCount: 0,
        totalChunkCount: 0,
        errors: [{ eventId: 'batch', error: String(error) }],
      };
    }
  }
}

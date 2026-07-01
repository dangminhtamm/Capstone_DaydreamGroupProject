import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { indexMemoryFromCalendar } from '@second-brain/ai';
import { insertMemoryChunks, pruneMemoryChunksForSource } from '@second-brain/db';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CalendarService {

    constructor(private readonly prisma: PrismaService) {}

    private normalizeEvent(googleEvent: calendar_v3.Schema$Event, userId: string) {
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
            throw new UnauthorizedException('User has not connected Google Calendar.');
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
                    ...(tokens.access_token && { google_access_token: tokens.access_token }),
                    ...(tokens.refresh_token && { google_refresh_token: tokens.refresh_token }),
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

            const upsertPromises = rawEvents.map((event) => {
                const normalizedData = this.normalizeEvent(event, user.id);

                return this.prisma.calendarEvent.upsert({
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
            });

            const syncedEvents = await Promise.all(upsertPromises);
            const indexingResult = await indexMemoryFromCalendar({
                userId: user.id,
                events: syncedEvents.map((event) => ({
                    eventId: event.id,
                    externalId: event.external_id,
                    title: event.title,
                    description: event.description,
                    startTime: event.start_time,
                    endTime: event.end_time,
                    htmlLink: event.html_link,
                })),
                insertChunks: (chunks) =>
                    this.prisma.$transaction(async (tx) => {
                        await insertMemoryChunks(tx as any, chunks);
                        if (chunks.length > 0) {
                            await pruneMemoryChunksForSource(tx as any, {
                                userId: chunks[0].userId,
                                sourceType: chunks[0].sourceType,
                                sourceId: chunks[0].sourceId,
                                keepChunkCount: chunks.length,
                            });
                        }
                    }),
            });

            return {
                message: 'Sync completed successfully',
                syncedCount: rawEvents.length,
                indexedEventCount: indexingResult.indexedEventCount,
                memoryChunkCount: indexingResult.totalChunkCount,
                indexErrors: indexingResult.errors,
            };

        } catch (error) {
            console.error('Failed to sync events:', error);
            throw new Error('Could not sync calendar events to database');
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
}

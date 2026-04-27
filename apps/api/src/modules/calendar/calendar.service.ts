import { Injectable, UnauthorizedException } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { prisma } from '@second-brain/db';

@Injectable()
export class CalendarService {

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
        const user = await prisma.user.findUnique({
            where: { supabaseId },
        });

        if (!user || !user.google_access_token) {
            throw new UnauthorizedException('User has not connected Google Calendar.');
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: user.google_access_token,
            refresh_token: user.google_refresh_token,
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

            return {
                message: 'Sync completed successfully',
                syncedCount: rawEvents.length,
            };

        } catch (error) {
            console.error('Failed to sync events:', error);
            throw new Error('Could not sync calendar events to database');
        }
    }


    async getEventsFromDb(supabaseId: string) {
        const user = await prisma.user.findUnique({
            where: { supabaseId },
        });

        if (!user) {
            throw new Error('User not found');
        }

        return await prisma.calendarEvent.findMany({
            where: {
                user_id: user.id,
                start_time: {
                    gte: new Date(),
                },
            },
            orderBy: {
                start_time: 'asc',
            },
            take: 20,
        });
    }
}
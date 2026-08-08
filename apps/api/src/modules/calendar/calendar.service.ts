import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptOAuthToken, encryptOAuthToken } from './oauth-token-crypto';
import { invalidateUserSearchCache } from '../../common/cache/search-answer-cache';
import {
    GOOGLE_SOURCE_SCOPES,
    getAllGoogleWorkspaceScopes,
    getGoogleConnectionStatus,
    markGoogleWorkspaceConnected,
    recordGoogleSyncFailure,
    recordGoogleSyncSuccess,
} from '../google-connections/google-connections';

type GoogleConnectInput = {
    supabaseId: string;
    email: string;
};

type GoogleCallbackInput = {
    code?: string;
    state?: string;
    error?: string;
};

type OAuthStatePayload = {
    supabaseId: string;
    iat: number;
};

@Injectable()
export class CalendarService {

    constructor(private readonly prisma: PrismaService) {}

    private readonly oauthScopes = getAllGoogleWorkspaceScopes();

    private getFrontendUrl() {
        const configuredUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN;
        const firstConfiguredUrl = configuredUrl
            ?.split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)[0];

        return firstConfiguredUrl || 'http://localhost:3000';
    }

    private getApiBaseUrl() {
        return process.env.API_PUBLIC_URL || process.env.API_URL || 'http://localhost:3001';
    }

    private getRedirectUri() {
        return (
            process.env.GOOGLE_REDIRECT_URI ||
            process.env.GOOGLE_CALLBACK_URL ||
            `${this.getApiBaseUrl().replace(/\/$/, '')}/api/calendar/oauth/callback`
        );
    }

    private getOAuthClient() {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            throw new BadRequestException(
                'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
            );
        }

        return new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            this.getRedirectUri(),
        );
    }

    private getStateSecret() {
        const secret =
            process.env.GOOGLE_OAUTH_STATE_SECRET ||
            process.env.SUPABASE_JWT_SECRET ||
            process.env.GOOGLE_CLIENT_SECRET;

        if (!secret && process.env.NODE_ENV === 'production') {
            throw new BadRequestException('GOOGLE_OAUTH_STATE_SECRET is required in production.');
        }

        return secret || 'dev-calendar-oauth-state-secret';
    }

    private signState(payload: OAuthStatePayload) {
        const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = createHmac('sha256', this.getStateSecret())
            .update(encodedPayload)
            .digest('base64url');

        return `${encodedPayload}.${signature}`;
    }

    private verifyState(state?: string): OAuthStatePayload {
        if (!state) {
            throw new BadRequestException('Missing OAuth state.');
        }

        const [encodedPayload, signature] = state.split('.');
        if (!encodedPayload || !signature) {
            throw new BadRequestException('Invalid OAuth state.');
        }

        const expectedSignature = createHmac('sha256', this.getStateSecret())
            .update(encodedPayload)
            .digest('base64url');

        const provided = Buffer.from(signature);
        const expected = Buffer.from(expectedSignature);
        if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
            throw new BadRequestException('Invalid OAuth state signature.');
        }

        const payload = JSON.parse(
            Buffer.from(encodedPayload, 'base64url').toString('utf8'),
        ) as OAuthStatePayload;

        const maxAgeMs = 10 * 60 * 1000;
        if (!payload.supabaseId || Date.now() - payload.iat > maxAgeMs) {
            throw new BadRequestException('OAuth state expired.');
        }

        return payload;
    }

    private buildFrontendRedirect(status: 'connected' | 'error', reason?: string) {
        const url = new URL('/settings', this.getFrontendUrl());
        url.searchParams.set('calendar', status);
        if (reason) {
            url.searchParams.set('reason', reason);
        }

        return url.toString();
    }

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

    async createGoogleConnectUrl(input: GoogleConnectInput) {
        await this.prisma.user.upsert({
            where: { supabaseId: input.supabaseId },
            update: { email: input.email },
            create: {
                supabaseId: input.supabaseId,
                email: input.email,
            },
        });

        const oauth2Client = this.getOAuthClient();
        const state = this.signState({
            supabaseId: input.supabaseId,
            iat: Date.now(),
        });

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: this.oauthScopes,
            state,
        });
    }

    async handleGoogleOAuthCallback(input: GoogleCallbackInput) {
        if (input.error) {
            return this.buildFrontendRedirect('error', input.error);
        }

        if (!input.code) {
            return this.buildFrontendRedirect('error', 'missing_code');
        }

        try {
            const state = this.verifyState(input.state);
            const oauth2Client = this.getOAuthClient();
            const { tokens } = await oauth2Client.getToken(input.code);

            if (!tokens.access_token && !tokens.refresh_token) {
                return this.buildFrontendRedirect('error', 'missing_tokens');
            }

            const connectedUser = await this.prisma.user.update({
                where: { supabaseId: state.supabaseId },
                data: {
                    google_connected: true,
                    ...(tokens.access_token && { google_access_token: encryptOAuthToken(tokens.access_token) }),
                    ...(tokens.refresh_token && { google_refresh_token: encryptOAuthToken(tokens.refresh_token) }),
                },
                select: { id: true },
            });
            await markGoogleWorkspaceConnected(this.prisma, connectedUser.id);

            return this.buildFrontendRedirect('connected');
        } catch (error) {
            console.error('Google OAuth callback failed:', error);
            return this.buildFrontendRedirect('error', 'callback_failed');
        }
    }

    async getConnectionStatus(input: GoogleConnectInput) {
        const user = await this.prisma.user.upsert({
            where: { supabaseId: input.supabaseId },
            update: { email: input.email },
            create: {
                supabaseId: input.supabaseId,
                email: input.email,
            },
            select: {
                id: true,
                google_connected: true,
                google_refresh_token: true,
                google_access_token: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const [eventCount, latestEvent] = await Promise.all([
            this.prisma.calendarEvent.count({
                where: { user_id: user.id },
            }),
            this.prisma.calendarEvent.findFirst({
                where: { user_id: user.id },
                orderBy: { updated_at: 'desc' },
                select: { updated_at: true },
            }),
        ]);

        const fallbackConnected = user.google_connected && Boolean(user.google_refresh_token || user.google_access_token);
        const connection = await getGoogleConnectionStatus(this.prisma, user.id, 'calendar', fallbackConnected);

        return {
            source: 'calendar',
            oauthMode: 'all_google_sources',
            connected: connection.connected && fallbackConnected,
            scopes: connection.scopes,
            requestedScopes: GOOGLE_SOURCE_SCOPES.calendar,
            workspaceScopes: this.oauthScopes,
            eventCount,
            lastSyncedAt: connection.lastSyncAt ?? latestEvent?.updated_at ?? null,
            lastError: connection.lastError,
            lastErrorAt: connection.lastErrorAt,
            syncCursor: connection.syncCursor,
        };
    }

    async syncGoogleEvents(supabaseId: string, options: { limit?: number } = {}) {
        const user = await this.prisma.user.findUnique({
            where: { supabaseId },
        });

        if (!user || (!user.google_access_token && !user.google_refresh_token)) {
            throw new UnauthorizedException('User has not connected Google Calendar.');
        }

        const oauth2Client = this.getOAuthClient();
        oauth2Client.setCredentials({
            access_token: decryptOAuthToken(user.google_access_token),
            refresh_token: decryptOAuthToken(user.google_refresh_token),
        });
        oauth2Client.on('tokens', async (tokens) => {
            await this.prisma.user.update({
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
            timeMin.setDate(timeMin.getDate() - 30);

            const timeMax = new Date();
            timeMax.setDate(timeMax.getDate() + 60);

            const maxResults = Math.min(Math.max(options.limit ?? 250, 1), 250);

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
                maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const rawEvents = response.data.items || [];

            const queuedIndexingJobs = await this.prisma.$transaction(async (tx) => {
                let queuedCount = 0;

                for (const event of rawEvents) {
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

                    queuedCount += 1;
                }

                return queuedCount;
            });
            const linking = await this.linkCalendarEventsToDiaries(user.id);
            await recordGoogleSyncSuccess(this.prisma, { userId: user.id, source: 'calendar' });

            return {
                message: 'Sync completed successfully; calendar memory indexing queued and diary linking checked.',
                syncedCount: rawEvents.length,
                queuedIndexingJobs,
                linkedDiaryCount: linking.linkedDiaryCount,
                linkedEventCount: linking.linkedEventCount,
                memoryIndexingStatus: 'queued',
            };

        } catch (error) {
            await recordGoogleSyncFailure(this.prisma, { userId: user.id, source: 'calendar', error });
            console.error('Failed to sync events:', error);
            throw new InternalServerErrorException('Could not sync calendar events to database');
        }
    }

    async linkCalendarEventsToDiariesForUser(supabaseId: string) {
        const user = await this.prisma.user.findUnique({
            where: { supabaseId },
            select: { id: true },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return this.linkCalendarEventsToDiaries(user.id);
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

    private async enqueueCalendarIndexingJob(
        tx: any,
        input: {
            userId: string;
            calendarEventId: string;
            externalId: string;
            title: string;
        },
    ) {
        const job = await tx.indexingOutbox.upsert({
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

        await this.expireSearchCache(tx, input.userId);
        return job;
    }

    private async expireSearchCache(tx: any, userId: string) {
        await tx.searchHistory?.updateMany?.({
            where: {
                user_id: userId,
                expires_at: { gt: new Date() },
            },
            data: { expires_at: new Date() },
        });
        await invalidateUserSearchCache(userId);
    }

    private async linkCalendarEventsToDiaries(userId: string) {
        const diaries = await this.prisma.diaryEntry.findMany({
            where: { user_id: userId },
            select: {
                id: true,
                user_id: true,
                raw_text: true,
                entry_date: true,
                calendar_events: {
                    select: { id: true },
                },
            },
            orderBy: { entry_date: 'desc' },
            take: 200,
        });

        let linkedDiaryCount = 0;
        let linkedEventCount = 0;

        for (const diary of diaries) {
            const activityDate = diary.entry_date;
            const startOfDay = new Date(activityDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(activityDate);
            endOfDay.setHours(23, 59, 59, 999);

            const dailyEvents = await this.prisma.calendarEvent.findMany({
                where: {
                    user_id: userId,
                    start_time: { gte: startOfDay, lte: endOfDay },
                },
            });

            if (!dailyEvents.length) continue;

            const alreadyLinked = new Set(diary.calendar_events.map((event) => event.id));
            const diaryKeywords = this.extractKeywords(diary.raw_text);
            const matchedEvents = dailyEvents.filter((event) => {
                if (alreadyLinked.has(event.id)) return false;

                let matchScore = 0;
                const timeDiffHours =
                    Math.abs(activityDate.getTime() - event.end_time.getTime()) / (1000 * 60 * 60);
                if (timeDiffHours <= 1) matchScore += 50;
                else if (timeDiffHours <= 3) matchScore += 30;
                else if (timeDiffHours <= 12) matchScore += 10;

                const eventKeywords = this.extractKeywords(`${event.title} ${event.description || ''}`);
                const matchedWords = eventKeywords.filter((keyword) => diaryKeywords.includes(keyword));
                matchScore += matchedWords.length * 15;

                return matchScore >= 40;
            });

            if (!matchedEvents.length) continue;

            const linkedEventIds = matchedEvents.map((event) => event.id);
            const memoryEventContext = matchedEvents.map((event) => ({
                id: event.id,
                title: event.title,
                startTime: event.start_time.toISOString(),
                endTime: event.end_time.toISOString(),
            }));

            await this.prisma.$transaction(async (tx) => {
                await tx.diaryEntry.update({
                    where: { id: diary.id },
                    data: {
                        calendar_events: {
                            connect: linkedEventIds.map((id) => ({ id })),
                        },
                    },
                });

                await tx.$executeRaw`
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
                    WHERE user_id = ${userId}
                      AND source_type = 'diary'
                      AND source_id = ${diary.id}
                `;

                await this.expireSearchCache(tx, userId);
            });

            linkedDiaryCount += 1;
            linkedEventCount += linkedEventIds.length;
        }

        return { linkedDiaryCount, linkedEventCount };
    }

    private extractKeywords(text: string) {
        const stopWords = new Set([
            'the', 'and', 'for', 'with', 'that', 'this', 'was', 'were', 'from',
            'have', 'has', 'had', 'about', 'into', 'our', 'you', 'your', 'today',
            'also', 'will', 'their', 'there', 'toi', 'tôi', 'cua', 'của', 'voi',
            'với', 'cho', 'mot', 'một', 'cac', 'các', 'nhung', 'những', 'duoc',
            'được', 'trong', 'ngay', 'ngày',
        ]);

        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((word) => word.length > 2 && !stopWords.has(word));
    }
}

import { Controller, Get, UseGuards, Req, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
    constructor(private readonly calendarService: CalendarService) { }

    @UseGuards(JwtAuthGuard)
    @Get('connect')
    async connect(@Req() req, @Query('source') source?: string) {
        const url = await this.calendarService.createGoogleConnectUrl({
            supabaseId: req.user.userId,
            email: req.user.email,
            source,
        });

        return { url };
    }

    @Get('oauth/callback')
    async oauthCallback(
        @Query('code') code: string | undefined,
        @Query('state') state: string | undefined,
        @Query('error') error: string | undefined,
        @Res() res: Response,
    ) {
        const redirectUrl = await this.calendarService.handleGoogleOAuthCallback({
            code,
            state,
            error,
        });

        return res.redirect(redirectUrl);
    }

    @UseGuards(JwtAuthGuard)
    @Get('status')
    async getStatus(@Req() req) {
        return this.calendarService.getConnectionStatus({
            supabaseId: req.user.userId,
            email: req.user.email,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('sync')
    async syncEvents(@Req() req, @Query('limit') limit?: string) {
        return await this.calendarService.syncGoogleEvents(req.user.userId, {
            limit: this.parseEventLimit(limit),
        });
    }

    @UseGuards(JwtAuthGuard)
    @Post('link')
    async linkEvents(@Req() req) {
        return await this.calendarService.linkCalendarEventsToDiariesForUser(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('events')
    async getEvents(@Req() req) {
        const events = await this.calendarService.getEventsFromDb(req.user.userId);

        return {
            message: 'Events fetched from database successfully',
            count: events.length,
            events: events,
        };
    }

    private parseEventLimit(value?: string) {
        if (!value) return undefined;

        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) return undefined;

        return Math.min(Math.max(parsed, 1), 250);
    }
}

@Controller('auth/google')
export class LegacyGoogleOAuthCallbackController {
    constructor(private readonly calendarService: CalendarService) { }

    @Get('callback')
    async oauthCallback(
        @Query('code') code: string | undefined,
        @Query('state') state: string | undefined,
        @Query('error') error: string | undefined,
        @Res() res: Response,
    ) {
        const redirectUrl = await this.calendarService.handleGoogleOAuthCallback({
            code,
            state,
            error,
        });

        return res.redirect(redirectUrl);
    }
}

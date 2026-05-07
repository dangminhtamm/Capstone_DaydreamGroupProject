import { Controller, Get, UseGuards, Req, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
    constructor(private readonly calendarService: CalendarService) { }

    @UseGuards(JwtAuthGuard)
    @Post('sync')
    async syncEvents(@Req() req) {
        return await this.calendarService.syncGoogleEvents(req.user.userId);
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
}
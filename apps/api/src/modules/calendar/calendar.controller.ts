import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('sync')
  async syncEvents(@Req() req: { user: { userId: string } }) {
    return this.calendarService.syncGoogleEvents(req.user.userId);
  }

  @Get('events')
  async getEvents(@Req() req: { user: { userId: string } }) {
    const events = await this.calendarService.getEventsFromDb(req.user.userId);

    return {
      message: 'Events fetched from database successfully',
      count: events.length,
      events,
    };
  }
}

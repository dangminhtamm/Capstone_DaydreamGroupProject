import { Module } from '@nestjs/common';
import { CalendarController, LegacyGoogleOAuthCallbackController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
    controllers: [CalendarController, LegacyGoogleOAuthCallbackController],
    providers: [CalendarService, PrismaService],
})
export class CalendarModule { }

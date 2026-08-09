import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { UploadController } from './modules/upload/upload.controller';
import { StorageService } from './storage/storage.service';
import { SummaryController } from './modules/summary/summary.controller';
import { SummaryService } from './modules/summary/summary.service';
import { DiaryController } from './modules/diary/diary.controller';
import { DiaryService } from './modules/diary/diary.service';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { AdminGuard } from './modules/auth/admin.guard';
import { PrismaService } from './prisma/prisma.service';
import { SearchController } from './modules/search/search.controller';
import { SearchService } from './modules/search/search.service';
import { HealthController } from './modules/health/health.controller';
import { HealthService } from './modules/health/health.service';
import { IndexingController } from './modules/indexing/indexing.controller';
import { IndexingService } from './modules/indexing/indexing.service';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DriveModule } from './modules/drive/drive.module';
import { GmailModule } from './modules/gmail/gmail.module';
import { GoogleConnectionsModule } from './modules/google-connections/google-connections.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '../../.env'),
      ],
    }),
    AuthModule,
    CalendarModule,
    ContactsModule,
    DriveModule,
    GmailModule,
    GoogleConnectionsModule,
  ],
  controllers: [
    AppController,
    DiaryController,
    UploadController,
    SummaryController,
    SearchController,
    HealthController,
    IndexingController,
  ],
  providers: [
    AppService,
    DiaryService,
    PrismaService,
    JwtAuthGuard,
    AdminGuard,
    StorageService,
    SummaryService,
    SearchService,
    HealthService,
    IndexingService,
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
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
import { PrismaService } from './prisma/prisma.service';
import { SearchController } from './modules/search/search.controller';
import { SearchService } from './modules/search/search.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '.env'),
    }),
    AuthModule,
    CalendarModule,
  ],
  controllers: [
    AppController,
    DiaryController,
    UploadController,
    SummaryController,
    SearchController,
  ],
  providers: [
    AppService,
    DiaryService,
    PrismaService,
    JwtAuthGuard,
    StorageService,
    SummaryService,
    SearchService,
  ],
})
export class AppModule {}

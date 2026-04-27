import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { UploadController } from '../upload/upload.controller';
import { StorageService } from './storage/storage.service';
import { SummaryController } from '../summary/summary.controller';
import { SummaryService } from '../summary/summary.service';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: join(process.cwd(), '.env'),
  }), AuthModule, CalendarModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadController } from '../upload/upload.controller';
import { StorageService } from './storage/storage.service';
import { SummaryController } from '../summary/summary.controller';
import { SummaryService } from '../summary/summary.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';

@Module({
  controllers: [GmailController],
  providers: [GmailService, PrismaService],
})
export class GmailModule {}

import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleConnectionsController } from './google-connections.controller';
import { GoogleConnectionsService } from './google-connections.service';

@Module({
  controllers: [GoogleConnectionsController],
  providers: [GoogleConnectionsService, PrismaService],
})
export class GoogleConnectionsModule {}

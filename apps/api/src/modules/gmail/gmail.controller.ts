import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GmailService } from './gmail.service';

@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req) {
    return this.gmailService.getConnectionStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncGmail(@Req() req, @Query('limit') limit?: string) {
    return this.gmailService.syncGmailMessages(req.user.userId, {
      limit: this.parseMessageLimit(limit),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  async getMessages(@Req() req) {
    const messages = await this.gmailService.getMessagesFromDb(req.user.userId);

    return {
      message: 'Gmail messages fetched from database successfully',
      count: messages.length,
      messages,
    };
  }

  private parseMessageLimit(value?: string) {
    if (!value) return undefined;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return undefined;

    return Math.min(Math.max(parsed, 1), 100);
  }
}

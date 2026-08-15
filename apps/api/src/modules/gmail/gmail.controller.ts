import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportGmailMessagesDto } from './dto/import-gmail-messages.dto';
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
  @Get('candidates')
  async getImportCandidates(
    @Req() req,
    @Query('limit') limit?: string,
    @Query('q') query?: string,
  ) {
    return this.gmailService.listImportCandidates(req.user.userId, {
      limit: this.parseMessageLimit(limit),
      query,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('import')
  async importSelectedMessages(@Req() req, @Body() body: ImportGmailMessagesDto) {
    return this.gmailService.importSelectedMessages(req.user.userId, body.messageIds);
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

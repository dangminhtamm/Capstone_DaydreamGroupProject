import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@Req() req) {
    return this.contactsService.getConnectionStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncContacts(@Req() req, @Query('limit') limit?: string) {
    return this.contactsService.syncGoogleContacts(req.user.userId, {
      limit: this.parseContactLimit(limit),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('contacts')
  async getContacts(@Req() req) {
    const contacts = await this.contactsService.getContactsFromDb(req.user.userId);

    return {
      message: 'Contacts fetched from database successfully',
      count: contacts.length,
      contacts,
    };
  }

  private parseContactLimit(value?: string) {
    if (!value) return undefined;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return undefined;

    return Math.min(Math.max(parsed, 1), 1000);
  }
}

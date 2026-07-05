import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('auth')
export class AuthController {

  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncSupabaseUser(
    @Req() req: { user: { userId: string; email: string } },
    @Body()
    body: {
      display_name?: string;
      google_access_token?: unknown;
      google_refresh_token?: unknown;
    } = {},
  ) {
    if ('google_access_token' in body || 'google_refresh_token' in body) {
      throw new BadRequestException(
        'Google OAuth tokens must be synced through the server-side OAuth flow.',
      );
    }

    const supabaseId = req.user.userId;
    const email = req.user.email;
    const { display_name } = body;

    const user = await this.prisma.user.upsert({
      where: {
        supabaseId,
      },
      update: {
        email,
        display_name,
      },
      create: {
        email,
        supabaseId,
        display_name,
      },
    });

    return {
      message: 'User synced successfully.',
      userId: user.id,
      googleConnected: user.google_connected,
    };
  }
}

import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('auth')
export class AuthController {

  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncSupabaseUser(
    @Req() req: { user: { userId: string; email: string } },
    @Body() body: { google_access_token?: string, google_refresh_token?: string, display_name?: string }
  ) {
    const supabaseId = req.user.userId;
    const email = req.user.email;
    const { google_access_token, google_refresh_token, display_name } = body;

    const user = await this.prisma.user.upsert({
      where: {
        email: email
      },
      update: {
        supabaseId: supabaseId,
        google_access_token: google_access_token,
        google_refresh_token: google_refresh_token,
        google_connected: true,
        display_name: display_name,
      },
      create: {
        email: email,
        supabaseId: supabaseId,
        google_access_token: google_access_token,
        google_refresh_token: google_refresh_token,
        google_connected: true,
        display_name: display_name,
      },
    });

    return { message: 'User synced successfully.', userId: user.id };
  }
}
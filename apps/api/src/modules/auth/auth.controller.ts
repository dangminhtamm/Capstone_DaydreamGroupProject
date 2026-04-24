import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { prisma } from '@second-brain/db';

@Controller('auth')
export class AuthController {

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncSupabaseUser(
    @Req() req,
    @Body() body: { google_access_token?: string, google_refresh_token?: string }
  ) {
    const supabaseId = req.user.userId;
    const email = req.user.email;
    const { google_access_token, google_refresh_token } = body;
    const user = await prisma.user.upsert({
      where: {
        email: email
      },
      update: {
        supabaseId: supabaseId,
        google_access_token: google_access_token,
        google_refresh_token: google_refresh_token,
      },
      create: {
        email: email,
        supabaseId: supabaseId,
        google_access_token: google_access_token,
        google_refresh_token: google_refresh_token,
      },
    });

    return { message: 'User synced successfully.', userId: user.id };
  }
}
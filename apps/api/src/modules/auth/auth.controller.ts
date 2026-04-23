import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    const user = await prisma.user.upsert({
      where: { supabaseId: supabaseId },
      update: {
        ...(body.google_access_token && { 
          google_connected: true, 
          google_access_token: body.google_access_token,
          google_refresh_token: body.google_refresh_token 
        }),
      },
      create: {
        supabaseId: supabaseId,
        email: email,
        ...(body.google_access_token && { 
          google_connected: true, 
          google_access_token: body.google_access_token,
          google_refresh_token: body.google_refresh_token 
        }),
      },
    });

    return { message: 'User synced successfully.', userId: user.id };
  }
}
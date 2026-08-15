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
import {
  canUseAdminPrivileges,
  isAdminEmail,
  normalizeUserRole,
  type AuthenticatedRequestUser,
} from './user-role';

@Controller('auth')
export class AuthController {

  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncSupabaseUser(
    @Req() req: { user: AuthenticatedRequestUser },
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
    const bootstrapAdmin = isAdminEmail(email) && canUseAdminPrivileges(req.user);

    const user = await this.prisma.user.upsert({
      where: {
        supabaseId,
      },
      update: {
        email,
        display_name,
        ...(bootstrapAdmin ? { role: 'admin' } : {}),
      },
      create: {
        email,
        supabaseId,
        display_name,
        role: bootstrapAdmin ? 'admin' : 'user',
      },
    });
    const role = normalizeUserRole(user.role);
    req.user.role = role;

    return {
      message: 'User synced successfully.',
      userId: user.id,
      role,
      isAdmin: role === 'admin',
      googleConnected: user.google_connected,
    };
  }
}

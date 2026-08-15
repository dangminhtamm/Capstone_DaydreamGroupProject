import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthenticatedRequestUser,
  canUseAdminPrivileges,
  isAdminEmail,
  normalizeUserRole,
} from './user-role';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedRequestUser;
    }>();
    const authUser = request.user;

    if (!authUser?.userId) {
      throw new ForbiddenException('Admin role is required.');
    }

    if (isAdminEmail(authUser.email)) {
      if (!canUseAdminPrivileges(authUser)) {
        throw new ForbiddenException('Verified admin email is required.');
      }

      authUser.role = 'admin';
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { supabaseId: authUser.userId },
      select: { role: true },
    });

    const role = normalizeUserRole(user?.role);
    authUser.role = role;

    if (role !== 'admin') {
      throw new ForbiddenException('Admin role is required.');
    }

    if (!canUseAdminPrivileges(authUser)) {
      throw new ForbiddenException('Verified admin email is required.');
    }

    return true;
  }
}

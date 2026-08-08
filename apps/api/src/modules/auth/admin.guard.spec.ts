import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function createContext(user: { userId?: string; email?: string; role?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  afterAll(() => {
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it('allows bootstrap admin emails from ADMIN_EMAILS without a DB lookup', async () => {
    process.env.ADMIN_EMAILS = 'owner@example.com';
    const user = { userId: 'supabase-1', email: 'Owner@Example.com' };
    const guard = new AdminGuard(prisma as any);

    await expect(guard.canActivate(createContext(user))).resolves.toBe(true);

    expect(user.role).toBe('admin');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows users with admin role in the database', async () => {
    process.env.ADMIN_EMAILS = '';
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
    const user = { userId: 'supabase-1', email: 'member@example.com' };
    const guard = new AdminGuard(prisma as any);

    await expect(guard.canActivate(createContext(user))).resolves.toBe(true);

    expect(user.role).toBe('admin');
  });

  it('rejects normal users', async () => {
    process.env.ADMIN_EMAILS = '';
    prisma.user.findUnique.mockResolvedValue({ role: 'user' });
    const guard = new AdminGuard(prisma as any);

    await expect(
      guard.canActivate(createContext({ userId: 'supabase-1', email: 'user@example.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

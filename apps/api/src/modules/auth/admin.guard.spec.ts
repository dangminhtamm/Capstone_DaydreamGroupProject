import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function createContext(user: { userId?: string; email?: string; role?: string; emailVerified?: boolean }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  const originalAdminRequireEmailVerified = process.env.ADMIN_REQUIRE_EMAIL_VERIFIED;
  const originalAuthRequireEmailVerified = process.env.AUTH_REQUIRE_EMAIL_VERIFIED;
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    restoreOptionalEnv('ADMIN_EMAILS', originalAdminEmails);
    process.env.ADMIN_REQUIRE_EMAIL_VERIFIED = 'false';
    process.env.AUTH_REQUIRE_EMAIL_VERIFIED = 'false';
  });

  afterAll(() => {
    restoreOptionalEnv('ADMIN_EMAILS', originalAdminEmails);
    restoreOptionalEnv('ADMIN_REQUIRE_EMAIL_VERIFIED', originalAdminRequireEmailVerified);
    restoreOptionalEnv('AUTH_REQUIRE_EMAIL_VERIFIED', originalAuthRequireEmailVerified);
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

  it('rejects admin emails when verified admin identity is required', async () => {
    process.env.ADMIN_EMAILS = 'owner@example.com';
    process.env.ADMIN_REQUIRE_EMAIL_VERIFIED = 'true';
    const user = { userId: 'supabase-1', email: 'owner@example.com', emailVerified: false };
    const guard = new AdminGuard(prisma as any);

    await expect(guard.canActivate(createContext(user))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows verified admin emails when verified admin identity is required', async () => {
    process.env.ADMIN_EMAILS = 'owner@example.com';
    process.env.ADMIN_REQUIRE_EMAIL_VERIFIED = 'true';
    const user = { userId: 'supabase-1', email: 'owner@example.com', emailVerified: true };
    const guard = new AdminGuard(prisma as any);

    await expect(guard.canActivate(createContext(user))).resolves.toBe(true);
    expect(user.role).toBe('admin');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

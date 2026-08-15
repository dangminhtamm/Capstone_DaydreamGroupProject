const USER_ROLES = ['user', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type AuthenticatedRequestUser = {
  userId: string;
  email: string;
  role?: UserRole;
  emailVerified?: boolean;
};

export function normalizeUserRole(value: unknown): UserRole {
  return value === 'admin' ? 'admin' : 'user';
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return false;

  return getConfiguredAdminEmails().has(normalizedEmail);
}

export function adminEmailVerificationRequired(): boolean {
  const configured =
    process.env.ADMIN_REQUIRE_EMAIL_VERIFIED ??
    process.env.AUTH_REQUIRE_EMAIL_VERIFIED;
  if (configured !== undefined) {
    return configured.toLowerCase() !== 'false';
  }

  return process.env.NODE_ENV === 'production';
}

export function canUseAdminPrivileges(
  authUser: Pick<AuthenticatedRequestUser, 'emailVerified'>,
): boolean {
  return !adminEmailVerificationRequired() || authUser.emailVerified === true;
}

function getConfiguredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

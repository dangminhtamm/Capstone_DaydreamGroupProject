type PrismaLike = {
  user: {
    findUnique: (args: { where: { email: string } }) => Promise<{ id: string } | null>;
    findFirst?: (args: { where: { supabaseId: string }; select: { id: boolean } }) => Promise<{ id: string } | null>;
    findMany: (args: {
      select: { id: boolean; email: boolean; display_name: boolean };
      take: number;
      orderBy: { created_at: "asc" | "desc" };
    }) => Promise<Array<{ id: string; email: string; display_name: string | null }>>;
  };
};

export async function resolveEvaluationUserId(
  prisma: PrismaLike,
  action: string,
): Promise<string | null> {
  const userId = process.env.SAMPLE_USER_ID ?? process.env.USER_ID;
  if (userId) return userId;

  const supabaseId =
    process.env.DEMO_SUPABASE_USER_ID ??
    process.env.SAMPLE_SUPABASE_USER_ID ??
    process.env.TEST_SUPABASE_USER_ID ??
    process.env.SUPABASE_USER_ID;
  if (supabaseId && prisma.user.findFirst) {
    const user = await prisma.user.findFirst({
      where: { supabaseId },
      select: { id: true },
    });
    if (user) return user.id;

    console.error(`No user found for configured Supabase id ${supabaseId}.`);
    process.exitCode = 1;
    return null;
  }

  const email = process.env.SAMPLE_USER_EMAIL ?? process.env.USER_EMAIL;
  if (email) {
    let user: { id: string } | null;
    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Could not resolve SAMPLE_USER_EMAIL from the database: ${message}`);
      process.exitCode = 1;
      return null;
    }

    if (user) return user.id;

    console.error(`No user found for SAMPLE_USER_EMAIL=${email}.`);
    process.exitCode = 1;
    await printUserHint(prisma, action);
    return null;
  }

  process.exitCode = 1;
  await printUserHint(prisma, action);
  return null;
}

async function printUserHint(prisma: PrismaLike, action: string): Promise<void> {
  console.error(
    `Set SAMPLE_USER_ID/USER_ID or SAMPLE_USER_EMAIL/USER_EMAIL to ${action}.`,
  );

  let users: Array<{ id: string; email: string; display_name: string | null }>;
  try {
    users = await prisma.user.findMany({
      select: { id: true, email: true, display_name: true },
      take: 5,
      orderBy: { created_at: "asc" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not list users from the database: ${message}`);
    return;
  }

  if (!users.length) {
    console.error("No rows found in users. Create/login a user before running this script.");
    return;
  }

  console.error("Available users:");
  for (const user of users) {
    const name = user.display_name ? ` (${user.display_name})` : "";
    console.error(`- ${user.id} ${user.email}${name}`);
  }
}

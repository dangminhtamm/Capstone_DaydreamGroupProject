import { createPrismaClient } from '../index.ts';

async function main() {
  const prisma = createPrismaClient();
  try {
    const res = await prisma.$queryRawUnsafe<{ id: string }[]>('SELECT id FROM public.users LIMIT 1');
    if (res.length > 0) {
      console.log('--- FOUND A USER ID ---');
      console.log(res[0].id);
      console.log('-----------------------');
    } else {
      console.log('No users found in Supabase auth.users table. Please sign up in the app first!');
    }
  } catch (error) {
    console.error('Error fetching user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

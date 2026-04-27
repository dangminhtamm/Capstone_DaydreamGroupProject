import { PrismaClient } from '@repo/db'; // Better: use the package directly
// Or if you haven't linked the package yet:
// import { PrismaClient } from '../../../generated/prisma';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
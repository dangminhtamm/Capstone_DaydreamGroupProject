// packages/db/src/index.ts
import { PrismaClient } from '@prisma/client';

// Instantiate it once here so you don't create multiple connections across your apps
export const prisma = new PrismaClient();

// Export all the types (like User, CalendarEvent, etc.) so NestJS can use them
export * from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchEntries(userId: string, query: string, limit: number = 10) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) return [];

    return this.prisma.diaryEntry.findMany({
      where: {
        user_id: user.id,
        raw_text: { contains: query, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { created_at: 'desc' },
    });
  }
}

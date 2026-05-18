import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SummaryService {
  constructor(private prisma: PrismaService) {}

  async findAll(supabaseUserId: string, options: { type?: string; limit?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: supabaseUserId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const summaries = await this.prisma.summary.findMany({
      where: {
        user_id: user.id,
        ...(options.type && { summary_type: options.type }),
      },
      orderBy: { created_at: 'desc' },
      take: options.limit ?? 10,
    });

    return {
      count: summaries.length,
      summaries: summaries.map((s) => ({
        id: s.id,
        type: s.summary_type,
        content: s.content,
        periodStart: s.period_start?.toISOString?.() ?? s.period_start,
        periodEnd: s.period_end?.toISOString?.() ?? s.period_end,
        createdAt: s.created_at?.toISOString?.() ?? s.created_at,
      })),
    };
  }

  async findOne(supabaseUserId: string, summaryId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: supabaseUserId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const summary = await this.prisma.summary.findFirst({
      where: {
        id: summaryId,
        user_id: user.id,
      },
    });

    if (!summary) {
      throw new NotFoundException('Summary not found');
    }

    return {
      id: summary.id,
      type: summary.summary_type,
      content: summary.content,
      periodStart: summary.period_start?.toISOString?.() ?? summary.period_start,
      periodEnd: summary.period_end?.toISOString?.() ?? summary.period_end,
      createdAt: summary.created_at?.toISOString?.() ?? summary.created_at,
    };
  }

  async generateSummary(content: string): Promise<string> {
    if (!content || content.length < 10) {
      return 'Content too short to summarize.';
    }
    return `Summary of: ${content.substring(0, 20)}... (Processed by AI)`;
  }
}

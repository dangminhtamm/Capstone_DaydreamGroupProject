import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@second-brain/db';
import { PrismaService } from '../../prisma/prisma.service';
import { ListSummariesQueryDto } from './dto/list-summaries-query.dto';

@Injectable()
export class SummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(supabaseId: string, query: ListSummariesQueryDto) {
    const user = await this.resolveUser(supabaseId);
    const where: Prisma.SummaryWhereInput = {
      user_id: user.id,
      ...(query.type && { summary_type: query.type }),
      ...(query.startDate || query.endDate
        ? {
            period_start: {
              ...(query.startDate && { gte: new Date(query.startDate) }),
              ...(query.endDate && { lte: new Date(query.endDate) }),
            },
          }
        : {}),
    };

    const summaries = await this.prisma.summary.findMany({
      where,
      orderBy: { period_start: 'desc' },
      take: query.limit ?? 20,
    });

    return {
      count: summaries.length,
      summaries: summaries.map((summary) => this.toClientSummary(summary)),
    };
  }

  async findOne(supabaseId: string, id: string) {
    const user = await this.resolveUser(supabaseId);
    const summary = await this.prisma.summary.findFirst({
      where: {
        id,
        user_id: user.id,
      },
    });

    if (!summary) {
      throw new NotFoundException('Summary not found');
    }

    return this.toClientSummary(summary);
  }

  private async resolveUser(supabaseId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private toClientSummary(summary: {
    id: string;
    summary_type: string;
    period_start: Date;
    period_end: Date;
    content: string;
    created_at: Date;
  }) {
    return {
      id: summary.id,
      type: summary.summary_type,
      periodStart: summary.period_start.toISOString(),
      periodEnd: summary.period_end.toISOString(),
      content: summary.content,
      createdAt: summary.created_at.toISOString(),
    };
  }
}

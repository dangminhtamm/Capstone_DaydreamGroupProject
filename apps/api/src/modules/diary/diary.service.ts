import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Adjust path based on your setup
import { CreateDiaryDto } from './dto/create-diary.dto';

@Injectable()
export class DiaryService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateDiaryDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const entry = await this.prisma.diaryEntry.create({
      data: {
        raw_text: `${dto.title}\n\n${dto.content}`,
        user_id: user.id,
        status: 'published',
      },
    });

    return this.toClientEntry(entry);
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) return [];

    const entries = await this.prisma.diaryEntry.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
    });

    return entries.map((entry) => this.toClientEntry(entry));
  }

  async findOne(userId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('Diary entry not found');

    const entry = await this.prisma.diaryEntry.findFirst({
      where: { id, user_id: user.id },
    });
    if (!entry) throw new NotFoundException('Diary entry not found');
    return this.toClientEntry(entry);
  }

  async update(userId: string, id: string, dto: Partial<CreateDiaryDto>) {
    await this.findOne(userId, id);
    const entry = await this.prisma.diaryEntry.update({
      where: { id },
      data: {
        raw_text: `${dto.title ?? ''}\n\n${dto.content ?? ''}`,
      },
    });

    return this.toClientEntry(entry);
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.diaryEntry.delete({ where: { id } });
  }

  private toClientEntry(entry: { id: string; raw_text: string; status: string; created_at: Date; updated_at: Date }) {
    const [title, ...contentParts] = entry.raw_text.split('\n\n');

    return {
      id: entry.id,
      title: title || 'Untitled',
      content: contentParts.join('\n\n') || entry.raw_text,
      status: entry.status,
      createdAt: entry.created_at.toISOString(),
      updatedAt: entry.updated_at.toISOString(),
    };
  }
}

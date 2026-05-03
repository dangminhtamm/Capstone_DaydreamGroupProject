import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Adjust path based on your setup
import { CreateDiaryDto } from './dto/create-diary.dto';

@Injectable()
export class DiaryService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateDiaryDto) {
    return this.prisma.entry.create({
      data: {
        title: dto.title,
        content: dto.content,
        userId: userId,
        // If your schema has an attachment relation:
        // attachments: { create: dto.attachments?.map(url => ({ url })) }
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.entry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { id, userId },
    });
    if (!entry) throw new NotFoundException('Diary entry not found');
    return entry;
  }

  async update(userId: string, id: string, dto: Partial<CreateDiaryDto>) {
    await this.findOne(userId, id); // Check ownership first
    return this.prisma.entry.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // Check ownership first
    return this.prisma.entry.delete({ where: { id } });
  }
}

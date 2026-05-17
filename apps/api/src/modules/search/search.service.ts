import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { answerMemory, answerMemoryStream } from '@second-brain/ai';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async answerQuestion(userId: string, queryDto: SearchQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const result = await answerMemory(queryDto.question, user.id, this.prisma, {
        limit: queryDto.limit ?? 8,
        maxDistance: queryDto.maxDistance,
        filters: {
          chunkType: queryDto.chunkType,
          sourceType: queryDto.sourceType,
          startDate: queryDto.startDate ? new Date(queryDto.startDate) : undefined,
          endDate: queryDto.endDate ? new Date(queryDto.endDate) : undefined,
        },
      });

      return {
        answer: result.answer,
        confidence: result.confidence,
        sources: result.citations,
      };
    } catch (error) {
      console.error('Failed to answer memory search question:', error);
      throw new InternalServerErrorException('Failed to answer memory search question.');
    }
  }

  /**
   * Streaming variant: returns a structured object with the Gemini stream
   * and pre-resolved citations. The controller will convert this into SSE.
   */
  async answerQuestionStream(userId: string, queryDto: SearchQueryDto) {
    const user = await this.prisma.user.findUnique({
      where: { supabaseId: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      return await answerMemoryStream(queryDto.question, user.id, this.prisma, {
        limit: queryDto.limit ?? 8,
        maxDistance: queryDto.maxDistance,
        filters: {
          chunkType: queryDto.chunkType,
          sourceType: queryDto.sourceType,
          startDate: queryDto.startDate ? new Date(queryDto.startDate) : undefined,
          endDate: queryDto.endDate ? new Date(queryDto.endDate) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to stream memory search answer:', error);
      throw new InternalServerErrorException('Failed to stream memory search answer.');
    }
  }
}


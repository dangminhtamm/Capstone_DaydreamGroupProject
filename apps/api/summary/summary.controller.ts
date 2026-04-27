import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { AuthGuard } from '../src/auth/auth.guard';
import { CreateSummaryDto } from './dto/create-summary.dto';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  /* @Post()
  async createSummary(@Body('content') content: string) {
    if (!content) {
      throw new BadRequestException('Content is required for summarization');
    }

    const summary = await this.summaryService.generateSummary(content);

    return {
      originalLength: content.length,
      summary: summary,
    };
  } */
  @Post()
  @UseGuards(AuthGuard) // 1. Validates Authentication
  async createSummary(@Body() body: CreateSummaryDto) {
    // 2. Validates Input via DTO
    return this.summaryService.generateSummary(body.content);
  }
}

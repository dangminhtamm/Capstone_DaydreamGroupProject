import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSummaryDto } from './dto/create-summary.dto';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Post()
  @UseGuards(JwtAuthGuard) // 1. Validates Authentication
  async createSummary(@Body() body: CreateSummaryDto) {
    // 2. Validates Input via DTO
    return this.summaryService.generateSummary(body.content);
  }
}

import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSummaryDto } from './dto/create-summary.dto';
import { ListSummariesQueryDto } from './dto/list-summaries-query.dto';

@Controller('summary')
@UseGuards(JwtAuthGuard)
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  async findAll(@Request() req, @Query() query: ListSummariesQueryDto) {
    return this.summaryService.findAll(req.user.userId, {
      type: query.type,
      startDate: query.startDate,
      endDate: query.endDate,
      limit: query.limit,
    });
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.summaryService.findOne(req.user.userId, id);
  }

  @Post()
  async createSummary(@Request() req, @Body() body: CreateSummaryDto) {
    return this.summaryService.generateSummary(req.user.userId, body);
  }
}

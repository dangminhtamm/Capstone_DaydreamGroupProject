import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SummaryService } from './summary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListSummariesQueryDto } from './dto/list-summaries-query.dto';

@Controller('summary')
@UseGuards(JwtAuthGuard)
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Get()
  async findAll(
    @Request() req: { user: { userId: string } },
    @Query() query: ListSummariesQueryDto,
  ) {
    return this.summaryService.findAll(req.user.userId, query);
  }

  @Get(':id')
  async findOne(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.summaryService.findOne(req.user.userId, id);
  }
}

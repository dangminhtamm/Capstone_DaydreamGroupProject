import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  async ask(@Request() req, @Body() queryDto: SearchQueryDto) {
    return this.searchService.answerQuestion(req.user.userId, queryDto);
  }

  @Get('history')
  async getHistory(@Request() req) {
    return this.searchService.getHistory(req.user.userId);
  }

  @Delete('history')
  async clearHistory(@Request() req) {
    return this.searchService.clearHistory(req.user.userId);
  }

  @Delete('history/:id')
  async deleteHistoryItem(@Request() req, @Param('id') id: string) {
    return this.searchService.deleteHistoryItem(req.user.userId, id);
  }

  @Get()
  async find(@Request() req, @Query() queryDto: SearchQueryDto) {
    return this.searchService.answerQuestion(req.user.userId, queryDto);
  }
}

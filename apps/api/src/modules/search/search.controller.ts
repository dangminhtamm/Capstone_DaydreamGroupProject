import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
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

  @Get()
  async find(@Request() req, @Query() queryDto: SearchQueryDto) {
    return this.searchService.answerQuestion(req.user.userId, queryDto);
  }
}

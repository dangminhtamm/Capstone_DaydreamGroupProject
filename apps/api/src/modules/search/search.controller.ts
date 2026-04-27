import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async find(@Request() req, @Query() queryDto: SearchQueryDto) {
    const limit = queryDto.limit ? parseInt(queryDto.limit, 10) : 10;

    const results = await this.searchService.searchEntries(
      req.user.id,
      queryDto.q,
      limit,
    );

    return {
      count: results.length,
      results,
    };
  }
}

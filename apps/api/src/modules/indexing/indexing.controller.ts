import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IndexingService } from './indexing.service';

@Controller('indexing')
@UseGuards(JwtAuthGuard)
export class IndexingController {
  constructor(private readonly indexingService: IndexingService) {}

  @Get('status')
  getStatus(@Request() req) {
    return this.indexingService.getStatus({
      supabaseId: req.user.userId,
      email: req.user.email,
    });
  }
}

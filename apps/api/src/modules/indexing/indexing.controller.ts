import { Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
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

  @Get('demo-readiness')
  getDemoReadiness(@Request() req) {
    return this.indexingService.getDemoReadiness({
      supabaseId: req.user.userId,
      email: req.user.email,
    });
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('jobs/:id/requeue')
  requeueJob(@Request() req, @Param('id') jobId: string) {
    return this.indexingService.requeueJob({
      supabaseId: req.user.userId,
      email: req.user.email,
    }, jobId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('jobs/requeue-dead-letter')
  requeueDeadLetterJobs(@Request() req) {
    return this.indexingService.requeueDeadLetterJobs({
      supabaseId: req.user.userId,
      email: req.user.email,
    });
  }
}

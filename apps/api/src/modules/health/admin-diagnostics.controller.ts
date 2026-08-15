import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HealthService } from './health.service';

@Controller('admin/diagnostics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminDiagnosticsController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getDiagnostics() {
    return this.healthService.getDiagnostics();
  }
}

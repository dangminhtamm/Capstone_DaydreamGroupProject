import { Controller, Get, Header } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @Header('Cache-Control', 'no-store')
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  getReadiness() {
    return this.healthService.getReadiness();
  }
}

import { Controller, Get, Header } from '@nestjs/common';
import { HealthService } from '../services/health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header('Content-Type', 'text/html')
  getStatusPage(): string {
    return this.healthService.getStatusPage();
  }
}

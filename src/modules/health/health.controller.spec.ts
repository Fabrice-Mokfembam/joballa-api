import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './controllers/health.controller';
import { HealthService } from './services/health.service';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('root', () => {
    it('should return the terminal-style status page', () => {
      const page = healthController.getStatusPage();

      expect(page).toContain('<title>Joballa Backend Terminal</title>');
      expect(page).toContain('>>> JOBALLA BACKEND TERMINAL v1.0');
      expect(page).toContain('SYSTEM STATUS: JOBALLA BACKEND ONLINE');
    });
  });
});

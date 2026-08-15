import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminDiagnosticsController } from './admin-diagnostics.controller';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('Health endpoints', () => {
  const healthService = {
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
    getDiagnostics: jest.fn(),
  } as unknown as HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes only the minimal live and ready handlers under /health', async () => {
    const controller = new HealthController(healthService);
    const liveness = { status: 'alive' as const };
    const readiness = { status: 'ready' as const, checkedAt: new Date().toISOString() };
    jest.mocked(healthService.getLiveness).mockReturnValue(liveness);
    jest.mocked(healthService.getReadiness).mockResolvedValue(readiness);

    expect(Reflect.getMetadata(PATH_METADATA, HealthController)).toBe('health');
    expect(controller.getLiveness()).toEqual(liveness);
    await expect(controller.getReadiness()).resolves.toEqual(readiness);
    expect('getHealth' in controller).toBe(false);
  });

  it('protects detailed diagnostics with both JWT and admin guards', async () => {
    const controller = new AdminDiagnosticsController(healthService);
    const diagnostics = { status: 'ok' as const };
    jest.mocked(healthService.getDiagnostics).mockResolvedValue(diagnostics as never);

    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminDiagnosticsController);

    expect(Reflect.getMetadata(PATH_METADATA, AdminDiagnosticsController)).toBe('admin/diagnostics');
    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
    await expect(controller.getDiagnostics()).resolves.toEqual(diagnostics);
  });
});

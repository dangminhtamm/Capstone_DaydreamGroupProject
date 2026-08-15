import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

describe('HealthService probes', () => {
  it('returns liveness without querying dependencies', () => {
    const prisma = { $queryRawUnsafe: jest.fn() };
    const service = new HealthService(prisma as never);

    expect(service.getLiveness()).toEqual({ status: 'alive' });
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('reports ready when the database is reachable', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const service = new HealthService(prisma as never);

    await expect(service.getReadiness()).resolves.toMatchObject({ status: 'ready' });
  });

  it('returns a sanitized 503 when the database is unavailable', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockRejectedValue(new Error('postgres host and credentials')),
    };
    const service = new HealthService(prisma as never);

    await expect(service.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);

    try {
      await service.getReadiness();
    } catch (error) {
      const response = (error as ServiceUnavailableException).getResponse();
      expect(response).toMatchObject({ status: 'not_ready' });
      expect(JSON.stringify(response)).not.toContain('postgres host and credentials');
    }
  });
});

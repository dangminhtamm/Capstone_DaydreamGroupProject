import type { Request, Response } from 'express';
import {
  clientIdentity,
  getRateLimitStatus,
  rateLimitMiddleware,
  resetInMemoryRateLimitForTesting,
} from './rate-limit.middleware';

jest.mock('../redis/redis-client', () => ({
  redisClient: {
    isConfigured: jest.fn(() => false),
    isConnected: jest.fn(() => false),
    getLastError: jest.fn(() => null),
    ping: jest.fn(async () => false),
    incr: jest.fn(),
    pexpire: jest.fn(),
    pttl: jest.fn(),
  },
}));

const { redisClient } = jest.requireMock('../redis/redis-client');

describe('rateLimitMiddleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RATE_LIMIT_REDIS_REQUIRED;
    delete process.env.RATE_LIMIT_TRUST_PROXY_HEADERS;
    delete process.env.RATE_LIMIT_TRUST_PROXY;
    delete process.env.RATE_LIMIT_CLIENT_IP_HEADER;
    delete process.env.TRUST_PROXY;
    process.env.NODE_ENV = 'test';
    redisClient.isConfigured.mockReturnValue(false);
    redisClient.isConnected.mockReturnValue(false);
    redisClient.getLastError.mockReturnValue(null);
    resetInMemoryRateLimitForTesting();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fails closed when Redis is required but not configured', () => {
    process.env.RATE_LIMIT_REDIS_REQUIRED = 'true';
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    rateLimitMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Rate limiting requires Redis, but Redis is not available.',
      }),
    );
  });

  it('uses local fallback when Redis is not required', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    rateLimitMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Storage', 'in-memory');
  });

  it('does not trust x-forwarded-for unless proxy headers are enabled', () => {
    const req = mockRequest({
      headers: { 'x-forwarded-for': '203.0.113.10' },
      ip: '10.0.0.5',
      remoteAddress: '10.0.0.5',
    });

    expect(clientIdentity(req)).toBe('ip:10.0.0.5');
  });

  it('uses trusted proxy headers when explicitly enabled', () => {
    process.env.RATE_LIMIT_TRUST_PROXY_HEADERS = 'true';
    const req = mockRequest({
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.5' },
      ip: '10.0.0.5',
      remoteAddress: '10.0.0.5',
    });

    expect(clientIdentity(req)).toBe('ip:203.0.113.10');
  });

  it('reports production-safe status only when required Redis is connected', () => {
    process.env.RATE_LIMIT_REDIS_REQUIRED = 'true';
    redisClient.isConfigured.mockReturnValue(true);
    redisClient.isConnected.mockReturnValue(false);

    expect(getRateLimitStatus()).toEqual(
      expect.objectContaining({
        redisRequired: true,
        productionSafe: false,
        fallbackAllowed: false,
      }),
    );
  });
});

function mockRequest(options: {
  headers?: Record<string, string>;
  ip?: string;
  remoteAddress?: string;
  path?: string;
} = {}): Request {
  const headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    path: options.path ?? '/api/diary',
    ip: options.ip ?? '127.0.0.1',
    socket: {
      remoteAddress: options.remoteAddress ?? '127.0.0.1',
    },
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function mockResponse(): Response {
  const response = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  return response as unknown as Response;
}

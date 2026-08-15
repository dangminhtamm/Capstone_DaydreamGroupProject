import type { Response } from 'express';
import {
  getSecurityHeaderStatus,
  securityHeadersMiddleware,
} from './security-headers.middleware';

describe('securityHeadersMiddleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    delete process.env.SECURITY_HEADERS_CSP;
    delete process.env.SECURITY_HEADERS_CSP_ENABLED;
    delete process.env.SECURITY_HEADERS_HSTS;
    delete process.env.SECURITY_HEADERS_HSTS_ENABLED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sets baseline API security headers and CSP', () => {
    const res = mockResponse();
    const next = jest.fn();

    securityHeadersMiddleware({} as any, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining("default-src 'none'"));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets HSTS in production', () => {
    process.env.NODE_ENV = 'production';
    const res = mockResponse();

    securityHeadersMiddleware({} as any, res, jest.fn());

    expect(res.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=15552000; includeSubDomains',
    );
  });

  it('can disable CSP through env for compatibility', () => {
    process.env.SECURITY_HEADERS_CSP_ENABLED = 'false';
    const res = mockResponse();

    securityHeadersMiddleware({} as any, res, jest.fn());

    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.any(String),
    );
    expect(getSecurityHeaderStatus().cspEnabled).toBe(false);
  });
});

function mockResponse(): Response {
  return {
    setHeader: jest.fn(),
  } as unknown as Response;
}

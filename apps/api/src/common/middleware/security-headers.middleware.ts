import type { NextFunction, Request, Response } from 'express';

export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (isContentSecurityPolicyEnabled()) {
    res.setHeader('Content-Security-Policy', getApiContentSecurityPolicy());
  }
  if (isStrictTransportSecurityEnabled()) {
    res.setHeader('Strict-Transport-Security', getStrictTransportSecurityValue());
  }
  next();
}

export function getSecurityHeaderStatus() {
  return {
    cspEnabled: isContentSecurityPolicyEnabled(),
    hstsEnabled: isStrictTransportSecurityEnabled(),
    headers: [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Resource-Policy',
      ...(isContentSecurityPolicyEnabled() ? ['Content-Security-Policy'] : []),
      ...(isStrictTransportSecurityEnabled() ? ['Strict-Transport-Security'] : []),
    ],
  };
}

function isContentSecurityPolicyEnabled() {
  return process.env.SECURITY_HEADERS_CSP_ENABLED !== 'false';
}

function getApiContentSecurityPolicy() {
  return (
    process.env.SECURITY_HEADERS_CSP ||
    [
      "default-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join('; ')
  );
}

function isStrictTransportSecurityEnabled() {
  if (process.env.SECURITY_HEADERS_HSTS_ENABLED === 'true') return true;
  if (process.env.SECURITY_HEADERS_HSTS_ENABLED === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function getStrictTransportSecurityValue() {
  return process.env.SECURITY_HEADERS_HSTS || 'max-age=15552000; includeSubDomains';
}

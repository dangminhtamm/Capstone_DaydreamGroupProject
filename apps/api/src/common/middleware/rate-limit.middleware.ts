import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import net from 'net';
import { redisClient } from '../redis/redis-client';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export type RateLimitProfile = {
  name: string;
  max: number;
  windowMs: number;
};

const defaultProfile: RateLimitProfile = {
  name: 'default',
  max: Number(process.env.RATE_LIMIT_DEFAULT_MAX ?? 240),
  windowMs: Number(process.env.RATE_LIMIT_DEFAULT_WINDOW_MS ?? 60_000),
};

const aiProfile: RateLimitProfile = {
  name: 'ai',
  max: Number(process.env.RATE_LIMIT_AI_MAX ?? 24),
  windowMs: Number(process.env.RATE_LIMIT_AI_WINDOW_MS ?? 60_000),
};

const uploadProfile: RateLimitProfile = {
  name: 'upload',
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX ?? 20),
  windowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS ?? 60_000),
};

const authProfile: RateLimitProfile = {
  name: 'auth',
  max: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 60),
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? 60_000),
};

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    next();
    return;
  }

  const profile = selectProfile(req.path);
  const now = Date.now();
  const key = `${profile.name}:${clientIdentity(req)}`;

  if (redisClient.isConfigured()) {
    void applyRedisRateLimit(key, profile, req, res, next).catch(() => {
      if (isRedisRequiredForRateLimit()) {
        sendRateLimitStorageUnavailable(req, res);
        return;
      }

      applyInMemoryRateLimit(key, profile, now, req, res, next);
    });
    return;
  }

  if (isRedisRequiredForRateLimit()) {
    sendRateLimitStorageUnavailable(req, res);
    return;
  }

  applyInMemoryRateLimit(key, profile, now, req, res, next);
}

export async function checkRedisRateLimitHealth() {
  if (!redisClient.isConfigured()) {
    return { configured: false, reachable: false, error: null };
  }

  try {
    return {
      configured: true,
      reachable: await redisClient.ping(),
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getRateLimitStatus() {
  const redisConfigured = redisClient.isConfigured();
  const redisRequired = isRedisRequiredForRateLimit();
  const redisConnected = redisClient.isConnected();

  return {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    storage: redisConfigured && redisConnected ? 'redis' : 'in-memory',
    redisRequired,
    redisConfigured,
    redisConnected,
    redisLastError: redisClient.getLastError(),
    fallbackAllowed: !redisRequired,
    productionSafe: !redisRequired || (redisConfigured && redisConnected),
    identity: {
      authenticatedRequests: 'authorization-bearer-hash',
      anonymousRequests: shouldTrustProxyHeaders()
        ? `trusted-proxy:${getClientIpHeaderName() ?? 'standard-forwarded-headers'}`
        : 'socket-remote-address',
      trustedProxyHeaders: shouldTrustProxyHeaders(),
      clientIpHeader: getClientIpHeaderName(),
    },
    profiles: {
      default: publicProfile(defaultProfile),
      ai: publicProfile(aiProfile),
      upload: publicProfile(uploadProfile),
      auth: publicProfile(authProfile),
    },
  };
}

async function applyRedisRateLimit(
  key: string,
  profile: RateLimitProfile,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const redisKey = `sb:rate-limit:${key}`;
  const count = await redisClient.incr(redisKey);

  if (count === 1) {
    await redisClient.pexpire(redisKey, profile.windowMs);
  }

  const ttlMs = await redisClient.pttl(redisKey);
  const resetAt = Date.now() + Math.max(ttlMs, 0);
  setRateLimitHeaders(res, profile, count, resetAt);
  res.setHeader('X-RateLimit-Storage', 'redis');

  if (count > profile.max) {
    sendRateLimitExceeded(req, res);
    return;
  }

  next();
}

function applyInMemoryRateLimit(
  key: string,
  profile: RateLimitProfile,
  now: number,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + profile.windowMs });
    setRateLimitHeaders(res, profile, 1, now + profile.windowMs);
    res.setHeader('X-RateLimit-Storage', 'in-memory');
    next();
    return;
  }

  bucket.count += 1;
  setRateLimitHeaders(res, profile, bucket.count, bucket.resetAt);
  res.setHeader('X-RateLimit-Storage', 'in-memory');

  if (bucket.count > profile.max) {
    sendRateLimitExceeded(req, res);
    return;
  }

  next();
}

function selectProfile(path: string): RateLimitProfile {
  if (path.startsWith('/api/search') || path.startsWith('/api/summary')) return aiProfile;
  if (path.startsWith('/api/upload')) return uploadProfile;
  if (path.startsWith('/api/auth') || path.includes('/oauth')) return authProfile;
  return defaultProfile;
}

export function clientIdentity(req: Request): string {
  const auth = req.header('authorization');
  if (auth) return `auth:${hashString(auth)}`;

  const trustedProxyIp = getTrustedProxyClientIp(req);
  const directIp = normalizeIp(req.ip) || normalizeIp(req.socket.remoteAddress);
  return `ip:${trustedProxyIp || directIp || 'unknown'}`;
}

export function resetInMemoryRateLimitForTesting() {
  buckets.clear();
}

function setRateLimitHeaders(
  res: Response,
  profile: RateLimitProfile,
  count: number,
  resetAt: number,
) {
  res.setHeader('X-RateLimit-Limit', String(profile.max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, profile.max - count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
}

function publicProfile(profile: RateLimitProfile) {
  return {
    max: profile.max,
    windowMs: profile.windowMs,
  };
}

function sendRateLimitExceeded(req: Request, res: Response) {
  res.status(429).json({
    statusCode: 429,
    message: 'Too many requests. Please slow down and try again shortly.',
    error: 'Too Many Requests',
    path: req.path,
    requestId: (req as Request & { requestId?: string }).requestId,
  });
}

function sendRateLimitStorageUnavailable(req: Request, res: Response) {
  res.setHeader('Retry-After', '5');
  res.status(503).json({
    statusCode: 503,
    message: 'Rate limiting requires Redis, but Redis is not available.',
    error: 'Service Unavailable',
    path: req.path,
    requestId: (req as Request & { requestId?: string }).requestId,
  });
}

function isRedisRequiredForRateLimit() {
  const configured = process.env.RATE_LIMIT_REDIS_REQUIRED;
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function shouldTrustProxyHeaders() {
  return (
    process.env.RATE_LIMIT_TRUST_PROXY_HEADERS === 'true' ||
    process.env.RATE_LIMIT_TRUST_PROXY === 'true' ||
    process.env.TRUST_PROXY === 'true'
  );
}

function getClientIpHeaderName() {
  return normalizeHeaderName(process.env.RATE_LIMIT_CLIENT_IP_HEADER);
}

function getTrustedProxyClientIp(req: Request) {
  const configuredHeader = getClientIpHeaderName();
  if (configuredHeader) {
    return extractClientIpFromHeader(req.header(configuredHeader), configuredHeader);
  }

  if (!shouldTrustProxyHeaders()) return null;

  return (
    extractClientIpFromHeader(req.header('cf-connecting-ip'), 'cf-connecting-ip') ||
    extractClientIpFromHeader(req.header('fly-client-ip'), 'fly-client-ip') ||
    extractClientIpFromHeader(req.header('x-real-ip'), 'x-real-ip') ||
    extractClientIpFromHeader(req.header('x-forwarded-for'), 'x-forwarded-for') ||
    extractClientIpFromHeader(req.header('forwarded'), 'forwarded')
  );
}

function extractClientIpFromHeader(value: string | undefined, headerName: string) {
  if (!value) return null;

  if (headerName === 'forwarded') {
    const forwardedFor = value
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.toLowerCase().startsWith('for='))
      ?.slice(4)
      .trim()
      .replace(/^"|"$/g, '');
    return normalizeIp(forwardedFor);
  }

  const firstValue = value.split(',')[0]?.trim();
  return normalizeIp(firstValue);
}

function normalizeHeaderName(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return /^[a-z0-9-]+$/.test(normalized) ? normalized : null;
}

function normalizeIp(value?: string | null) {
  if (!value) return null;
  let candidate = value.trim();
  if (!candidate) return null;

  if (candidate.startsWith('[')) {
    candidate = candidate.slice(1, candidate.indexOf(']'));
  } else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(candidate)) {
    candidate = candidate.split(':')[0] ?? candidate;
  }

  return net.isIP(candidate) ? candidate : null;
}

function hashString(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

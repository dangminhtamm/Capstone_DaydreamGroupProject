import type { NextFunction, Request, Response } from 'express';
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
      applyInMemoryRateLimit(key, profile, now, req, res, next);
    });
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

  return {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    storage: redisConfigured && redisClient.isConnected() ? 'redis' : 'in-memory',
    redisConfigured,
    redisConnected: redisClient.isConnected(),
    redisLastError: redisClient.getLastError(),
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
    next();
    return;
  }

  bucket.count += 1;
  setRateLimitHeaders(res, profile, bucket.count, bucket.resetAt);

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

function clientIdentity(req: Request): string {
  const auth = req.header('authorization');
  if (auth) return `auth:${hashString(auth)}`;

  const forwardedFor = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || req.ip || req.socket.remoteAddress || 'unknown';
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

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

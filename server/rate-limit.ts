import type { RequestHandler } from "express";

type Key = string;

interface Bucket {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

const buckets = new Map<Key, Bucket>();

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 10; // max attempts per window
const BLOCK_MS = 15 * 60 * 1000; // 15 minutes lockout after abuse

/**
 * Very small in-memory rate limiter for login attempts.
 * Not meant for horizontal scaling, but enough to reduce brute-force in
 * single-instance deployments.
 */
export const rateLimitLogin: RequestHandler = (req, res, next) => {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";

  const key = `login:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (bucket?.blockedUntil && bucket.blockedUntil > now) {
    res.status(429).json({
      error:
        "Trop de tentatives de connexion depuis cette adresse IP. Réessayez plus tard.",
    });
    return;
  }

  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now });
    return next();
  }

  bucket.count += 1;

  if (bucket.count > MAX_ATTEMPTS) {
    bucket.blockedUntil = now + BLOCK_MS;
    res.status(429).json({
      error:
        "Trop de tentatives de connexion depuis cette adresse IP. Réessayez plus tard.",
    });
    return;
  }

  return next();
};


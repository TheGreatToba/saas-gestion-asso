import type { Request, RequestHandler } from "express";

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
 * Basic in-memory rate limiter configuration.
 *
 * NOTE: This implementation is intentionally simple and process-local.
 * For horizontal scaling, the storage logic behind this function should be
 * replaced by a shared backend (e.g. Redis) while keeping the public
 * middleware API unchanged.
 */
export interface RateLimitOptions {
  /**
   * Logical name for this limiter (e.g. "login", "password-reset").
   * Used in keys and log messages only.
   */
  name: string;
  /** Sliding window duration in milliseconds. */
  windowMs: number;
  /** Maximum number of accepted requests within the window. */
  maxAttempts: number;
  /**
   * Duration in milliseconds during which the key is completely blocked
   * after exceeding maxAttempts.
   */
  blockMs: number;
  /**
   * Optional key builder. Defaults to client IP address.
   * Can be used to rate limit by userId, email, route, etc.
   */
  keyFromRequest?: (req: Request) => string | undefined;
}

const getClientIp = (req: Request): string => {
  // Prefer first IP in X-Forwarded-For if present.
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  // Fallbacks:
  // - req.ip will respect Express "trust proxy" configuration if enabled
  // - remoteAddress is the raw socket address.
  return (
    req.ip ||
    (req.connection as any)?.remoteAddress ||
    (req.socket as any)?.remoteAddress ||
    "unknown"
  );
};

export const createRateLimiter = (options: RateLimitOptions): RequestHandler => {
  const { name, windowMs, maxAttempts, blockMs, keyFromRequest } = options;

  return (req, res, next) => {
    const keyBase = keyFromRequest?.(req) ?? getClientIp(req);
    const key = `${name}:${keyBase}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (bucket?.blockedUntil && bucket.blockedUntil > now) {
      // Basic logging to help monitor abusive sources and attacks.
      console.warn(
        `[rate-limit] key="${key}" still blocked until ${new Date(
          bucket.blockedUntil,
        ).toISOString()}`,
      );
      res.status(429).json({
        error:
          "Trop de requêtes depuis cette origine. Réessayez plus tard.",
      });
      return;
    }

    if (!bucket || now - bucket.firstAttemptAt > windowMs) {
      buckets.set(key, { count: 1, firstAttemptAt: now });
      return next();
    }

    bucket.count += 1;

    if (bucket.count > maxAttempts) {
      bucket.blockedUntil = now + blockMs;

      console.warn(
        `[rate-limit] key="${key}" blocked for ${blockMs}ms after ${bucket.count} attempts in ${windowMs}ms window`,
      );

      res.status(429).json({
        error:
          "Trop de requêtes depuis cette origine. Réessayez plus tard.",
      });
      return;
    }

    return next();
  };
};

/**
 * Login-specific rate limiter, built on top of the generic
 * createRateLimiter() factory.
 *
 * This keeps login protection configuration isolated while allowing
 * reuse of the same mechanism for other endpoints (password reset,
 * public search, etc.).
 *
 * NOTE: This limiter is keyed by client IP address. For more precise
 * control (e.g. per user or per email), plug a different keyFromRequest
 * implementation.
 */
export const rateLimitLogin: RequestHandler = createRateLimiter({
  name: "login",
  windowMs: WINDOW_MS,
  maxAttempts: MAX_ATTEMPTS,
  blockMs: BLOCK_MS,
});


import type { Request, RequestHandler } from "express";

export type Key = string;

export interface Bucket {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

/**
 * Store interface for rate limit state. Allows swapping in-memory store for
 * Redis (RATE_LIMIT_REDIS_URL) when scaling horizontally.
 * Async to support Redis; in-memory store resolves synchronously.
 */
export interface RateLimitStore {
  get(key: Key): Bucket | undefined | Promise<Bucket | undefined>;
  set(key: Key, bucket: Bucket): void | Promise<void>;
}

const inMemoryBuckets = new Map<Key, Bucket>();

const inMemoryStore: RateLimitStore = {
  get: (key) => inMemoryBuckets.get(key),
  set: (key, bucket) => {
    inMemoryBuckets.set(key, bucket);
  },
};

/** Used by createRateLimiter. Set via setRateLimitStore() when using Redis. */
let store: RateLimitStore = inMemoryStore;

export function setRateLimitStore(s: RateLimitStore): void {
  store = s;
}

export function getRateLimitStore(): RateLimitStore {
  return store;
}

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 10; // max attempts per window
const BLOCK_MS = 15 * 60 * 1000; // 15 minutes lockout after abuse

/**
 * Basic in-memory rate limiter configuration.
 * For horizontal scaling, use setRateLimitStore() with a Redis-backed store
 * when RATE_LIMIT_REDIS_URL is set (see .env.example).
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

    const run = async () => {
      const bucket = await Promise.resolve(store.get(key));

      if (bucket?.blockedUntil && bucket.blockedUntil > now) {
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
        await Promise.resolve(store.set(key, { count: 1, firstAttemptAt: now }));
        return next();
      }

      bucket.count += 1;
      await Promise.resolve(store.set(key, bucket));

      if (bucket.count > maxAttempts) {
        bucket.blockedUntil = now + blockMs;
        await Promise.resolve(store.set(key, bucket));

        console.warn(
          `[rate-limit] key="${key}" blocked for ${blockMs}ms after ${bucket.count} attempts in ${windowMs}ms window`,
        );

        res.status(429).json({
          error:
            "Trop de requêtes depuis cette origine. Réessayez plus tard.",
        });
        return;
      }

      next();
    };

    run().catch((err) => {
      console.error("[rate-limit] store error", err);
      next(err);
    });
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


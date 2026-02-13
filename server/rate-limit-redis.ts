/**
 * Redis-backed rate limit store for horizontal scaling.
 * Use when RATE_LIMIT_REDIS_URL is set; otherwise the in-memory store is used.
 *
 * Keys: rate:{name}:{key} with JSON bucket value. TTL set to avoid unbounded growth
 * (windowMs + blockMs + margin).
 */

import Redis from "ioredis";
import type { RateLimitStore, Bucket, Key } from "./rate-limit";

const KEY_PREFIX = "rate:";
const DEFAULT_TTL_SEC = 30 * 60; // 30 minutes (covers 5min window + 15min block)

function serialize(bucket: Bucket): string {
  return JSON.stringify(bucket);
}

function deserialize(value: string): Bucket | undefined {
  try {
    const o = JSON.parse(value) as Bucket;
    if (typeof o.count !== "number" || typeof o.firstAttemptAt !== "number") {
      return undefined;
    }
    return {
      count: o.count,
      firstAttemptAt: o.firstAttemptAt,
      blockedUntil: typeof o.blockedUntil === "number" ? o.blockedUntil : undefined,
    };
  } catch {
    return undefined;
  }
}

export function createRedisRateLimitStore(
  redisUrl: string,
  options?: { keyPrefix?: string; ttlSeconds?: number },
): RateLimitStore {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  });

  const prefix = options?.keyPrefix ?? KEY_PREFIX;
  const ttlSec = options?.ttlSeconds ?? DEFAULT_TTL_SEC;

  redis.on("error", (err) => {
    console.error("[rate-limit-redis] Redis error:", err.message);
  });

  return {
    async get(key: Key): Promise<Bucket | undefined> {
      const fullKey = prefix + key;
      const value = await redis.get(fullKey);
      if (value == null) return undefined;
      return deserialize(value);
    },

    async set(key: Key, bucket: Bucket): Promise<void> {
      const fullKey = prefix + key;
      await redis.setex(fullKey, ttlSec, serialize(bucket));
    },
  };
}

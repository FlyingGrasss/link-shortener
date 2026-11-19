export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * In-memory token bucket. Capacity refills over the window, so a caller can
 * burst up to `capacity` requests and then sustains `capacity / window`.
 */
export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(capacity = 10, windowMs = 60_000) {
    this.capacity = capacity;
    this.refillPerMs = capacity / windowMs;
  }

  take(key: string, now: number = Date.now()): RateLimitDecision {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };
    const elapsed = Math.max(0, now - bucket.updatedAt);

    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerMs);
    bucket.updatedAt = now;
    this.buckets.set(key, bucket);

    let decision: RateLimitDecision;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      decision = {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: Math.floor(bucket.tokens),
      };
    } else {
      const waitMs = (1 - bucket.tokens) / this.refillPerMs;
      decision = {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        remaining: 0,
      };
    }

    this.sweep(now);
    return decision;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;

    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > 10 * 60_000) {
        this.buckets.delete(key);
      }
    }
  }
}

import { NextResponse } from "next/server";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

interface WindowBucket {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, WindowBucket>();

  constructor() {
    // Periodically prune expired entries every 2 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, bucket] of this.store.entries()) {
        if (now > bucket.resetTime) {
          this.store.delete(key);
        }
      }
    }, 120000).unref?.();
  }

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    let bucket = this.store.get(key);

    if (!bucket || now > bucket.resetTime) {
      bucket = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, bucket);
      return {
        success: true,
        remaining: limit - 1,
        reset: bucket.resetTime,
      };
    }

    if (bucket.count >= limit) {
      return {
        success: false,
        remaining: 0,
        reset: bucket.resetTime,
      };
    }

    bucket.count += 1;
    return {
      success: true,
      remaining: limit - bucket.count,
      reset: bucket.resetTime,
    };
  }

  // Testing helper to reset or force limit
  resetKey(key: string) {
    this.store.delete(key);
  }
}

export const rateLimiter: RateLimiter = new InMemoryRateLimiter();

export function getClientIp(req: Request): string {
  // Only trust X-Forwarded-For if configured behind a trusted proxy or in non-production environments
  const trustProxy =
    process.env.TRUST_PROXY === "true" || process.env.NODE_ENV !== "production";

  if (trustProxy) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }

  // Without a configured proxy, do not trust client-supplied headers
  return "127.0.0.1";
}

export function rateLimitResponse(customMessage?: string) {
  return NextResponse.json(
    {
      error:
        customMessage ||
        "Rate limit reached. You have made too many requests in a short time. Please wait a few moments and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": "60",
      },
    }
  );
}

export function withRateLimit(
  keyPrefix: string,
  limit: number,
  windowSeconds: number,
  customMessage?: string
) {
  return (handler: (req: Request, ctx?: any) => Promise<any>) => {
    return async (req: Request, ctx?: any) => {
      const ip = getClientIp(req);
      const userKey = ctx?.user?.id ? `${keyPrefix}_${ctx.user.id}_${ip}` : `${keyPrefix}:${ip}`;
      const rateCheck = await rateLimiter.check(userKey, limit, windowSeconds);
      if (!rateCheck.success) {
        return rateLimitResponse(customMessage);
      }
      return handler(req, ctx);
    };
  };
}

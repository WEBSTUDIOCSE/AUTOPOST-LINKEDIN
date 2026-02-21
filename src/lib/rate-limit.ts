/**
 * In-Memory Rate Limiter
 *
 * A simple fixed-window rate limiter for server-side API routes.
 * Keyed by any string (IP address, user ID, route, etc.).
 *
 * ⚠️  NOTE: This implementation stores state in-process.
 *     It resets on every cold start / deployment and does NOT
 *     work across multiple server instances.
 *
 *     For production multi-instance deployments (e.g. Vercel with
 *     >1 region or Lambda cold starts), replace with a Redis-backed
 *     solution such as @upstash/ratelimit + @upstash/redis.
 *
 * Usage:
 * ```ts
 * const { allowed, retryAfterSec } = checkRateLimit(`auth:${ip}`, 10, 60_000);
 * if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 * ```
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Module-level map — persists across requests within the same server process
const store = new Map<string, RateLimitEntry>();

// Periodically evict expired entries to prevent unbounded memory growth.
// Runs every 5 minutes if the module is alive.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Seconds until the rate limit window resets. 0 when allowed. */
  retryAfterSec: number;
  /** Remaining allowed requests in the current window. */
  remaining: number;
}

/**
 * Check and increment the rate limit counter for a given key.
 *
 * @param key         - Unique key (e.g. `auth:${ip}`)
 * @param maxRequests - Max requests allowed per window
 * @param windowMs    - Window duration in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // No entry or window has expired — start a fresh window
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: maxRequests - 1 };
  }

  // Within window — check quota
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
      remaining: 0,
    };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSec: 0, remaining: maxRequests - entry.count };
}

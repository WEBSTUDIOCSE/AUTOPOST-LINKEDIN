/**
 * AI Adapter — Rate Limiter
 *
 * A sliding-window rate limiter that protects against API key abuse
 * and provider rate-limit violations. Works in-memory — suitable for
 * serverless / edge environments where each cold start resets the window.
 *
 * Kie.AI default limit: 20 requests per 10 seconds.
 * Gemini default limit: 15 requests per 60 seconds (free tier).
 *
 * Usage:
 * ```ts
 * const limiter = new RateLimiter({ maxRequests: 20, windowMs: 10_000 });
 * await limiter.acquire(); // blocks if over limit (or throws)
 * ```
 */

import type { AIProvider } from './types';
import { AIAdapterError } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RateLimiterConfig {
  /** Max requests allowed within the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Optional: wait for a slot instead of throwing (default: true) */
  waitForSlot?: boolean;
  /** Optional: max time to wait for a slot in ms (default: 30000) */
  maxWaitMs?: number;
}

export interface RateLimiterStatus {
  /** Total requests in the current window */
  currentCount: number;
  /** Max allowed requests per window */
  maxRequests: number;
  /** Ms remaining until the earliest request expires from the window */
  msUntilSlot: number;
  /** Whether a new request would be allowed right now */
  isAllowed: boolean;
}

// ─── Pre-configured limits per provider ──────────────────────────────────────

/**
 * Sensible defaults per provider. Override via `AIProviderConfig.rateLimit`.
 */
export const DEFAULT_RATE_LIMITS: Record<AIProvider, RateLimiterConfig> = {
  kieai: {
    maxRequests: 18,    // 20 official limit, buffer of 2
    windowMs: 10_000,   // 10 seconds
    waitForSlot: true,
    maxWaitMs: 30_000,
  },
  gemini: {
    maxRequests: 14,    // 15 RPM free tier, buffer of 1
    windowMs: 60_000,   // 60 seconds
    waitForSlot: true,
    maxWaitMs: 60_000,
  },
};

// ─── Rate Limiter Implementation ─────────────────────────────────────────────

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly waitForSlot: boolean;
  private readonly maxWaitMs: number;

  /** Timestamps (ms) of each request in the current window */
  private timestamps: number[] = [];

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.waitForSlot = config.waitForSlot ?? true;
    this.maxWaitMs = config.maxWaitMs ?? 30_000;
  }

  /**
   * Acquire a slot. If `waitForSlot` is true, this will sleep until a slot
   * opens. Otherwise it throws immediately when the limit is exceeded.
   */
  async acquire(provider: AIProvider = 'kieai'): Promise<void> {
    this.pruneExpired();

    // Fast path: slot available
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(Date.now());
      return;
    }

    // No slot available
    if (!this.waitForSlot) {
      throw new AIAdapterError(
        `Rate limit exceeded: ${this.maxRequests} requests per ${this.windowMs}ms. Try again later.`,
        provider,
        'RATE_LIMITED',
        429,
      );
    }

    // Wait for the earliest slot to expire
    const waitStart = Date.now();
    while (this.timestamps.length >= this.maxRequests) {
      const elapsed = Date.now() - waitStart;
      if (elapsed >= this.maxWaitMs) {
        throw new AIAdapterError(
          `Rate limit: waited ${elapsed}ms but no slot opened (max ${this.maxRequests}/${this.windowMs}ms).`,
          provider,
          'RATE_LIMIT_TIMEOUT',
          429,
        );
      }

      // Calculate how long until the oldest request expires
      const oldestTs = this.timestamps[0]!;
      const msUntilExpiry = (oldestTs + this.windowMs) - Date.now();
      const sleepTime = Math.max(msUntilExpiry, 50); // min 50ms to avoid busy-loop

      await this.sleep(Math.min(sleepTime, this.maxWaitMs - elapsed));
      this.pruneExpired();
    }

    this.timestamps.push(Date.now());
  }

  /**
   * Check current status without consuming a slot.
   */
  getStatus(): RateLimiterStatus {
    this.pruneExpired();
    const currentCount = this.timestamps.length;
    const isAllowed = currentCount < this.maxRequests;

    let msUntilSlot = 0;
    if (!isAllowed && this.timestamps.length > 0) {
      const oldestTs = this.timestamps[0]!;
      msUntilSlot = Math.max((oldestTs + this.windowMs) - Date.now(), 0);
    }

    return {
      currentCount,
      maxRequests: this.maxRequests,
      msUntilSlot,
      isAllowed,
    };
  }

  /**
   * Reset all tracked timestamps.
   */
  reset(): void {
    this.timestamps = [];
  }

  // ── Private ────────────────────────────────────────────────────────────

  private pruneExpired(): void {
    const cutoff = Date.now() - this.windowMs;
    this.timestamps = this.timestamps.filter((ts) => ts > cutoff);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

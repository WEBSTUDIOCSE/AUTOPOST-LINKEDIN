/**
 * AI Adapter — Circuit Breaker
 *
 * Prevents cascading failures by tracking consecutive errors from a provider.
 * After `threshold` consecutive failures, the circuit opens and rejects all
 * requests for `resetTimeoutMs` before allowing a single probe request through.
 *
 * States:
 *   CLOSED  → normal operation, tracking failures
 *   OPEN    → all requests rejected instantly (saves cost & quota)
 *   HALF_OPEN → one probe request allowed; success → CLOSED, failure → OPEN
 */

import { AIAdapterError } from './types';
import type { AIProvider } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  threshold: number;
  /** How long the circuit stays open before allowing a probe, in ms (default: 60 000) */
  resetTimeoutMs: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStatus {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  msUntilProbe: number;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  threshold: 5,
  resetTimeoutMs: 60_000,
};

// ─── Implementation ──────────────────────────────────────────────────────────

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime: number | null = null;

  private readonly threshold: number;
  private readonly resetTimeoutMs: number;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    const merged = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.threshold = merged.threshold;
    this.resetTimeoutMs = merged.resetTimeoutMs;
  }

  /**
   * Call before every request. Throws immediately if the circuit is OPEN
   * and the reset timeout hasn't elapsed yet.
   */
  guardRequest(provider: AIProvider): void {
    if (this.state === 'CLOSED') return;

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.lastFailureTime ?? 0);
      if (elapsed >= this.resetTimeoutMs) {
        // Allow a single probe
        this.state = 'HALF_OPEN';
        return;
      }
      throw new AIAdapterError(
        `Circuit breaker OPEN for provider "${provider}" after ${this.consecutiveFailures} consecutive failures. ` +
        `Retry in ${Math.ceil((this.resetTimeoutMs - elapsed) / 1000)}s.`,
        provider,
        'CIRCUIT_OPEN',
        503,
      );
    }

    // HALF_OPEN → allow the probe request through
  }

  /** Call after a successful request to reset the breaker. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  /** Call after a failed request. May trip the circuit to OPEN. */
  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Probe failed — reopen
      this.state = 'OPEN';
      return;
    }

    if (this.consecutiveFailures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  /** Read-only status snapshot. */
  getStatus(): CircuitBreakerStatus {
    let msUntilProbe = 0;
    if (this.state === 'OPEN' && this.lastFailureTime) {
      msUntilProbe = Math.max(
        this.resetTimeoutMs - (Date.now() - this.lastFailureTime),
        0,
      );
    }

    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      msUntilProbe,
    };
  }

  /** Force-reset (e.g. for testing). */
  reset(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
  }
}

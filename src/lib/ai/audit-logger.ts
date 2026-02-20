/**
 * AI Adapter — Audit Logger
 *
 * Structured logging for every AI generation request.
 * Logs userId, capability, model, a SHA-256 hash of the prompt (never plaintext),
 * duration, status, and error code if applicable.
 *
 * Currently writes to server console in structured JSON.
 * Can be swapped for a persistent store (Firestore, BigQuery, etc.) later.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Firebase UID of the requesting user */
  userId: string;
  /** Which capability was requested */
  capability: 'text' | 'image' | 'video';
  /** AI provider used */
  provider: string;
  /** Model ID used */
  model: string;
  /** SHA-256 hex hash of the prompt (never store plaintext) */
  promptHash: string;
  /** Wall-clock duration in ms */
  durationMs: number;
  /** Outcome */
  status: 'success' | 'error' | 'blocked';
  /** Error code if status === 'error' */
  errorCode?: string;
  /** Blocking rule if status === 'blocked' */
  blockRule?: string;
}

// ─── Hashing ─────────────────────────────────────────────────────────────────

/**
 * Compute a hex-encoded SHA-256 hash of a string.
 * Uses Node.js crypto (available in Next.js server routes).
 */
async function sha256(input: string): Promise<string> {
  // Use Web Crypto API (available in Edge Runtime & Node 18+)
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Logger ──────────────────────────────────────────────────────────────────

/**
 * Log a generation request. Call this in the API route after the request
 * completes (success or failure).
 */
export async function logAuditEntry(
  params: Omit<AuditEntry, 'timestamp' | 'promptHash'> & { prompt: string },
): Promise<void> {
  try {
    const promptHash = await sha256(params.prompt);

    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      userId: params.userId,
      capability: params.capability,
      provider: params.provider,
      model: params.model,
      promptHash,
      durationMs: params.durationMs,
      status: params.status,
      ...(params.errorCode && { errorCode: params.errorCode }),
      ...(params.blockRule && { blockRule: params.blockRule }),
    };

    // Structured JSON log — easily parseable by Cloud Logging / Datadog / etc.
    console.log(JSON.stringify({ type: 'AI_AUDIT', ...entry }));
  } catch {
    // Audit logging must never crash the request
    console.error('[AI_AUDIT] Failed to write audit entry');
  }
}

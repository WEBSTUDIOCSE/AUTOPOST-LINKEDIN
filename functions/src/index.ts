/**
 * Firebase Cloud Functions — LinkedIn Autoposter
 *
 * Three scheduled functions that call the Next.js admin API endpoints:
 *
 *   generateDrafts  — Every 5 min (testing) → /api/autoposter/generate-all
 *   cutoffReview    — Every 5 min (testing) → /api/autoposter/cutoff-all
 *   publishPosts    — Every 5 min (testing) → /api/autoposter/publish-all
 *
 * Production schedules (IST):
 *   generateDrafts  — 9 PM  Mon/Tue/Wed  → "0 21 * * 1,2,3"
 *   cutoffReview    — 3 AM  Tue/Wed/Thu  → "0 3 * * 2,3,4"
 *   publishPosts    — 8–11 AM Tue/Wed/Thu every 30 min → "0,30 8-11 * * 2,3,4"
 *
 * Required environment variables (set via Firebase Functions config):
 *   APP_URL      — Your deployed Next.js URL (e.g. https://your-app.vercel.app)
 *   CRON_SECRET  — Shared secret checked in each Next.js admin endpoint
 *
 * Set them with:
 *   firebase functions:config:set app.url="https://your-app.vercel.app" app.cron_secret="your-secret"
 *
 * Or use a .env file (Functions Gen 2):
 *   Create functions/.env with APP_URL and CRON_SECRET
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';

// ── Config ────────────────────────────────────────────────────────────────────

// These are read from the Functions runtime environment.
// Set them before deploying:  firebase functions:config:set (for Gen 1)
// For Gen 2: add them to functions/.env or set via Google Cloud Secret Manager
const getAppUrl  = () => process.env.APP_URL   ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
const getCronSecret = () => process.env.CRON_SECRET ?? '';

// ── Helper ────────────────────────────────────────────────────────────────────

async function callEndpoint(path: string): Promise<void> {
  const appUrl = getAppUrl();
  const cronSecret = getCronSecret();

  if (!appUrl || !cronSecret) {
    logger.error(`[functions] APP_URL or CRON_SECRET not configured — skipping ${path}`);
    return;
  }

  const url = `${appUrl}${path}`;
  logger.info(`[functions] Calling ${url}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
    });

    const body = await res.text();
    logger.info(`[functions] ${path} → ${res.status}: ${body.slice(0, 200)}`);

    if (!res.ok) {
      logger.error(`[functions] ${path} returned error ${res.status}: ${body}`);
    }
  } catch (err) {
    logger.error(`[functions] Failed to call ${path}:`, err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GENERATE DRAFTS
// Runs every 5 minutes (testing). Switch to production schedule before go-live.
// ═══════════════════════════════════════════════════════════════════════════════

export const generateDrafts = onSchedule(
  {
    // TESTING: every 5 minutes
    schedule: 'every 5 minutes',

    // PRODUCTION: uncomment this and comment out 'every 5 minutes' above
    // schedule: '0 21 * * 1,2,3',  // 9 PM IST Mon/Tue/Wed

    timeZone: 'Asia/Kolkata',
    region: 'us-central1',
    timeoutSeconds: 540,  // 9 minutes — AI generation can be slow
    memory: '512MiB',
  },
  async () => {
    await callEndpoint('/api/autoposter/generate-all');
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CUTOFF REVIEW
// Auto-skips posts that weren't reviewed before the deadline.
// ═══════════════════════════════════════════════════════════════════════════════

export const cutoffReview = onSchedule(
  {
    // TESTING: every 5 minutes
    schedule: 'every 5 minutes',

    // PRODUCTION: uncomment this and comment out 'every 5 minutes' above
    // schedule: '0 3 * * 2,3,4',  // 3 AM IST Tue/Wed/Thu

    timeZone: 'Asia/Kolkata',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async () => {
    await callEndpoint('/api/autoposter/cutoff-all');
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PUBLISH POSTS
// Publishes approved posts whose scheduledFor time has arrived.
// ═══════════════════════════════════════════════════════════════════════════════

export const publishPosts = onSchedule(
  {
    // TESTING: every 5 minutes
    schedule: 'every 5 minutes',

    // PRODUCTION: uncomment this and comment out 'every 5 minutes' above
    // schedule: '0,30 8-11 * * 2,3,4',  // Every 30 min, 8–11 AM IST Tue/Wed/Thu

    timeZone: 'Asia/Kolkata',
    region: 'us-central1',
    timeoutSeconds: 300,  // LinkedIn uploads can be slow
    memory: '512MiB',
  },
  async () => {
    await callEndpoint('/api/autoposter/publish-all');
  },
);

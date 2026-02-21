/**
 * Firestore Collection Constants
 *
 * Centralizes all collection names with environment-aware switching.
 * Every service should import from here instead of hardcoding strings.
 */

import { IS_PRODUCTION } from '@/lib/firebase/config/environments';

// ── Auth (existing) ──────────────────────────────────────────────────────────
export const USERS_COLLECTION = IS_PRODUCTION ? 'prod_users' : 'uat_users';

// ── Payments (existing) ──────────────────────────────────────────────────────
export const PAYMENTS_COLLECTION = IS_PRODUCTION ? 'payments' : 'payments_test';

// ── Autoposter ───────────────────────────────────────────────────────────────
const ENV_PREFIX = IS_PRODUCTION ? 'prod' : 'uat';

/** Series — ordered sequences of topics */
export const SERIES_COLLECTION = `${ENV_PREFIX}_series`;

/** Posts — AI drafts through to published artefacts */
export const POSTS_COLLECTION = `${ENV_PREFIX}_posts`;

/** Ideas — user's manual idea bank */
export const IDEAS_COLLECTION = `${ENV_PREFIX}_ideas`;

/** Autoposter profiles — LinkedIn tokens, schedule, persona */
export const PROFILES_COLLECTION = `${ENV_PREFIX}_autoposter_profiles`;

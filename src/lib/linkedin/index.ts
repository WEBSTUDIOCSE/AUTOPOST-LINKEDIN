/**
 * LinkedIn Autoposter — Barrel Export
 *
 * Single entry point for all autoposter functionality:
 *   import { AutoposterAPI, type Post, type Series } from '@/lib/linkedin';
 */

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  // Series
  Series,
  SeriesStatus,
  SeriesTopic,
  // Posts
  Post,
  PostStatus,
  // Ideas
  Idea,
  // Profile
  AutoposterProfile,
  PostingDay,
  PostingSchedule,
  // AI
  PostGenerationContext,
  // LinkedIn API
  LinkedInCreatePostPayload,
  LinkedInProfile,
  // Notifications
  NotificationType,
  NotificationPayload,
  // Dashboard
  DashboardStats,
  CalendarDay,
} from './types';

// ── Collections ──────────────────────────────────────────────────────────────
export {
  SERIES_COLLECTION,
  POSTS_COLLECTION,
  IDEAS_COLLECTION,
  PROFILES_COLLECTION,
} from './collections';

// ── Services ─────────────────────────────────────────────────────────────────
export { SeriesService } from './services/series.service';
export { PostService } from './services/post.service';
export { IdeaService } from './services/idea.service';
export { ProfileService } from './services/profile.service';

// ── AI Generation (server-only) ──────────────────────────────────────────────
export { generatePostDraft, regeneratePostDraft } from './services/post-generator.service';
export type { GeneratedPost } from './services/post-generator.service';

// ── LinkedIn OAuth (server-only) ─────────────────────────────────────────────
export {
  getLinkedInAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getLinkedInProfile,
  createLinkedInPost,
} from './linkedin-oauth';
export type { LinkedInTokens } from './linkedin-oauth';

// ── Notifications (client-side) ──────────────────────────────────────────────
export {
  requestNotificationPermission,
  onForegroundMessage,
  showBrowserNotification,
} from './services/notification.service';

// ═══════════════════════════════════════════════════════════════════════════════
// FACADE — mirrors the APIBook pattern from firebase/services
// ═══════════════════════════════════════════════════════════════════════════════

import { SeriesService } from './services/series.service';
import { PostService } from './services/post.service';
import { IdeaService } from './services/idea.service';
import { ProfileService } from './services/profile.service';

/**
 * Centralized access to all autoposter services.
 *
 * Usage:
 *   import { AutoposterAPI } from '@/lib/linkedin';
 *   const series = await AutoposterAPI.series.getActiveSeries(userId);
 *   await AutoposterAPI.posts.approve(postId);
 */
export const AutoposterAPI = {
  series: SeriesService,
  posts: PostService,
  ideas: IdeaService,
  profile: ProfileService,
} as const;

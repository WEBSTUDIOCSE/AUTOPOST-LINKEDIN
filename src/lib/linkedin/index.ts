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
  PostMediaType,
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
  LinkedInUploadResponse,
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

// ── Notifications (client-side) ──────────────────────────────────────────────
export {
  requestNotificationPermission,
  onForegroundMessage,
  showBrowserNotification,
} from './services/notification.service';

// NOTE: Services (SeriesService, PostService, IdeaService, ProfileService,
// post-generator, linkedin-oauth) use firebase-admin and are server-only.
// Import them directly from their file paths in API routes:
//   import { SeriesService } from '@/lib/linkedin/services/series.service';

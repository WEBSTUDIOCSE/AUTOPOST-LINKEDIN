/**
 * LinkedIn Autoposter — Core Type Definitions
 *
 * This module defines every data shape used across the autoposter system:
 * Firestore documents, AI prompt inputs, LinkedIn API payloads, scheduling
 * config, and FCM notification payloads.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SERIES (topic sequences)
// ═══════════════════════════════════════════════════════════════════════════════

/** Overall series lifecycle */
export type SeriesStatus = 'active' | 'paused' | 'completed';

/** A single topic slot inside a series */
export interface SeriesTopic {
  /** Topic title — fed to the AI as the post subject */
  title: string;
  /** Optional extra context / bullet points for the AI */
  notes?: string;
}

/**
 * Firestore: `series/{seriesId}`
 *
 * Represents an ordered sequence of topics the user wants to post about.
 * The system walks through `topicQueue` one-by-one on each posting day.
 */
export interface Series {
  id: string;
  userId: string;
  /** Human-readable name — "Next.js Mastery", "TypeScript Deep Dive" */
  title: string;
  /** Freeform tag — used for grouping & filtering */
  category: string;
  /** Status of this series */
  status: SeriesStatus;
  /** Ordered list of topics the AI should cover */
  topicQueue: SeriesTopic[];
  /**
   * 0-based index into `topicQueue` pointing to the *next* topic to draft.
   * After a post is published / skipped, this advances by 1.
   * When `currentIndex >= topicQueue.length`, the series auto-completes.
   */
  currentIndex: number;
  /**
   * Priority order across all active series for this user.
   * Lower = posts first.  When a series completes, the system picks the
   * next-lowest-order active series automatically.
   */
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEAS (manual idea bank)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Firestore: `ideas/{ideaId}`
 *
 * A quick note the user jotted down — can be standalone or attached to a
 * series.  When attached, the idea overrides the next auto-picked topic.
 */
export interface Idea {
  id: string;
  userId: string;
  /** Raw text: bullet points, sentences, links — whatever the user typed */
  text: string;
  /** If set, the idea is queued for a specific series */
  seriesId?: string;
  /** True once the system has consumed this idea to generate a draft */
  used: boolean;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POSTS (drafts → published)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full lifecycle of a post:
 *
 *   pending_review → approved → published
 *                  → skipped  (missed the review window)
 *                  → rejected (user explicitly rejected)
 *                  → failed   (LinkedIn API error)
 */
export type PostStatus =
  | 'pending_review'
  | 'approved'
  | 'skipped'
  | 'rejected'
  | 'published'
  | 'failed';

/**
 * Firestore: `posts/{postId}`
 *
 * Central document for every LinkedIn post — from AI draft through to
 * published artefact.
 */
export interface Post {
  id: string;
  userId: string;

  // ── Series & Topic context ─────────────────────────────────────────────
  /** Series this post belongs to (null for standalone / idea-bank posts) */
  seriesId?: string;
  /** Index within the series topic queue */
  topicIndex?: number;
  /** Human-readable topic title */
  topic: string;

  // ── Content ────────────────────────────────────────────────────────────
  /** AI-generated draft (never mutated after creation) */
  content: string;
  /** User-edited version — if the user modifies the draft, this takes over */
  editedContent?: string;
  /** Summary of the previous post — fed to the AI for continuity */
  previousPostSummary?: string;
  /** The raw idea/prompt fed to the AI when generating this post */
  inputPrompt?: string;

  // ── Scheduling ─────────────────────────────────────────────────────────
  /** When the post should be published on LinkedIn */
  scheduledFor: Date;
  /** After this timestamp, unapproved posts become "skipped" */
  reviewDeadline: Date;
  status: PostStatus;

  // ── After publishing ───────────────────────────────────────────────────
  /** Timestamp when LinkedIn confirmed publication */
  publishedAt?: Date;
  /** The URN / ID returned by LinkedIn's Create Post API */
  linkedinPostId?: string;
  /** If status is "failed", the error message from the last attempt */
  failureReason?: string;
  /** Number of publish retry attempts */
  retryCount: number;

  // ── Timestamps ─────────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROFILE (LinkedIn connection + preferences)
// ═══════════════════════════════════════════════════════════════════════════════

/** Which day-slots are enabled and at what time (IST / local) */
export interface PostingDay {
  enabled: boolean;
  /** 24h time string e.g. "10:00" — when to publish */
  postTime: string;
}

/** Weekly posting schedule — each day can be independently toggled */
export interface PostingSchedule {
  monday: PostingDay;
  tuesday: PostingDay;
  wednesday: PostingDay;
  thursday: PostingDay;
  friday: PostingDay;
  saturday: PostingDay;
  sunday: PostingDay;
}

/**
 * Firestore: `autoposter_profiles/{userId}`
 *
 * Stores user preferences, LinkedIn tokens, FCM token, and the AI
 * persona configuration used for draft generation.
 */
export interface AutoposterProfile {
  userId: string;

  // ── LinkedIn OAuth ─────────────────────────────────────────────────────
  linkedinAccessToken?: string;
  linkedinRefreshToken?: string;
  linkedinTokenExpiry?: Date;
  /** LinkedIn member URN — needed for "author" field in post creation */
  linkedinMemberUrn?: string;
  linkedinConnected: boolean;

  // ── FCM (push notifications) ───────────────────────────────────────────
  fcmToken?: string;

  // ── AI persona ─────────────────────────────────────────────────────────
  /**
   * Natural-language description of your writing style.
   * Fed to the AI as a system instruction so every draft sounds like *you*.
   * Example: "I write short, punchy LinkedIn posts with 2-3 paragraphs.
   * I use emojis sparingly. I share what I built and what I learned."
   */
  persona?: string;

  // ── Scheduling ─────────────────────────────────────────────────────────
  postingSchedule: PostingSchedule;
  /** IANA timezone — e.g. "Asia/Kolkata" */
  timezone: string;
  /**
   * Hour (0-23) at which the nightly draft generation runs.
   * Default: 21 (9 PM local time).
   */
  draftGenerationHour: number;
  /**
   * Hour (0-23) after which unapproved posts are auto-skipped.
   * Default: 3 (3 AM local time).
   */
  reviewDeadlineHour: number;

  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROMPT CONTEXT (passed to the post-generation AI call)
// ═══════════════════════════════════════════════════════════════════════════════

/** Everything the AI needs to generate a good draft */
export interface PostGenerationContext {
  /** The topic to write about */
  topic: string;
  /** Extra notes / bullet points the user attached */
  notes?: string;
  /** Series title for thematic context */
  seriesTitle?: string;
  /** Short summary of the previous post — enables continuity */
  previousPostSummary?: string;
  /** User's tone / style description */
  persona?: string;
  /** What day the post will be published (so AI can reference "today") */
  publishDay: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINKEDIN API (request / response shapes)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Payload for LinkedIn's Create Post (UGC) API — simplified view.
 * See https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 */
export interface LinkedInCreatePostPayload {
  author: string;  // e.g. "urn:li:person:abc123"
  commentary: string;
  visibility: 'PUBLIC' | 'CONNECTIONS';
  distribution: {
    feedDistribution: 'MAIN_FEED';
    targetEntities: [];
    thirdPartyDistributionChannels: [];
  };
  lifecycleState: 'PUBLISHED';
  isReshareDisabledByAuthor: boolean;
}

/** Subset of LinkedIn's profile response that we need */
export interface LinkedInProfile {
  sub: string;           // member URN id
  name: string;
  email: string;
  picture?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FCM NOTIFICATION PAYLOADS
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationType =
  | 'draft_ready'      // New draft generated — review it
  | 'post_skipped'     // Review deadline passed, post was held
  | 'post_published'   // Successfully posted to LinkedIn
  | 'post_failed'      // LinkedIn API error
  | 'linkedin_token_expiring'; // OAuth token expiring soon

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  /** Post ID to deep-link into the review screen */
  postId?: string;
  /** URL to open when tapped */
  clickAction?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD / UI TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Summary stats for the dashboard */
export interface DashboardStats {
  totalPublished: number;
  totalSkipped: number;
  totalPending: number;
  currentStreak: number;         // consecutive posting days
  activeSeries: string | null;   // title of the currently active series
  nextScheduledPost: Post | null;
}

/** Calendar view entry */
export interface CalendarDay {
  date: string;            // ISO date string "YYYY-MM-DD"
  dayOfWeek: string;
  isPostingDay: boolean;
  post?: Post;
}

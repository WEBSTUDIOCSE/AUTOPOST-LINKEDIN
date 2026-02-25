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
  /** Default HTML template for posts in this series */
  templateId?: string;
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
  | 'scheduled'
  | 'pending_review'
  | 'approved'
  | 'skipped'
  | 'rejected'
  | 'published'
  | 'failed';

/** What kind of media accompanies the text */
export type PostMediaType = 'text' | 'image' | 'video' | 'html';

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

  // ── Media ──────────────────────────────────────────────────────────────
  /** Type of media attached — defaults to 'text' for text-only posts */
  mediaType: PostMediaType;
  /**
   * URL of the generated image or video.
   * For images: a public URL (Firebase Storage or AI provider CDN).
   * For videos: a public URL to the video file.
   * Undefined for text-only posts.
   */
  mediaUrl?: string;
  /**
   * LinkedIn asset URN — set after uploading media to LinkedIn.
   * Used in the post creation payload when publishing.
   * Format: "urn:li:image:..." or "urn:li:video:..."
   */
  linkedinMediaAsset?: string;
  /** MIME type of the media (e.g. 'image/png', 'video/mp4') */
  mediaMimeType?: string;
  /** The AI prompt used to generate the media */
  mediaPrompt?: string;
  /** AI-generated HTML infographic — stored for preview, converted to PNG at publish time */
  htmlContent?: string;
  /** Number of carousel pages (1 = single card, 2+ = multi-page carousel sliced from one tall document) */
  pageCount?: number;
  /**
   * Pre-captured PNG image URLs stored in Firebase Storage.
   * Set at approval time so scheduled Firebase Functions can publish
   * without needing a browser for HTML→PNG conversion.
   */
  imageUrls?: string[];

  // ── AI model metadata (saved with scheduled posts for deferred generation) ──
  templateId?: string;
  provider?: string;
  textModel?: string;

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

  // ── AI model preferences ───────────────────────────────────────────────
  /** AI provider for auto-generated drafts — 'gemini' | 'kieai' (default: env config) */
  preferredProvider?: 'gemini' | 'kieai';
  /** Explicit text model name for draft generation */
  preferredTextModel?: string;
  /** Preferred media type for auto-generated posts — 'text' | 'image' | 'html' */
  preferredMediaType?: 'text' | 'image' | 'html';

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
  /** Firebase UID — used to namespace Storage uploads */
  userId?: string;
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
  /** Desired media type — 'text' (default), 'image', or 'video' */
  mediaType?: PostMediaType;

  // ── Model Override (user control) ────────────────────────────────────────

  /** AI provider override — 'gemini' | 'kieai' (default: env config) */
  provider?: 'gemini' | 'kieai';
  /** Explicit model for text generation */
  textModel?: string;
  /** Explicit model for image generation */
  imageModel?: string;
  /** Explicit model for video generation */
  videoModel?: string;
  /** Temperature override (0–2, default depends on mediaType) */
  temperature?: number;
  /** Max tokens override for text generation */
  maxTokens?: number;

  // ── Media config overrides ───────────────────────────────────────────────

  /** Aspect ratio for image/video (e.g. '1:1', '16:9') */
  aspectRatio?: string;
  /** Image resolution: '1K', '2K', '4K' */
  imageSize?: string;
  /** Number of images to generate (1–4) */
  numberOfImages?: number;
  /** Video duration in seconds */
  durationSeconds?: number;
  /** Video resolution: '720p', '1080p', '4k' */
  videoResolution?: string;
  /** Negative prompt — what to avoid in media generation */
  negativePrompt?: string;

  // ── Template reference ───────────────────────────────────────────────────

  /** HTML template ID — used as style reference for AI HTML generation */
  templateId?: string;
  /** Resolved template HTML — injected by API route before calling generator */
  templateHtml?: string;
  /** Template dimensions — width is always set, height 0 means auto */
  templateDimensions?: { width: number; height?: number };
  /** Number of carousel pages to generate (1 = single card, 2-9 = multi-page) */
  pageCount?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML TEMPLATES (reusable visual styles for AI HTML generation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Firestore: `templates/{templateId}`
 *
 * A saved HTML design template that the AI references when generating
 * infographic cards. Users paste a sample HTML document, give it a name,
 * and associate it with series or select it per-post.
 *
 * The AI receives the template HTML as a style reference and generates
 * new content matching that design language (fonts, colors, layout).
 */
export interface HtmlTemplate {
  id: string;
  userId: string;
  /** Human-readable name — "Dark IDE Theme", "Minimal Light", etc. */
  name: string;
  /** Short description of the template's visual style */
  description?: string;
  /** The full HTML sample that defines the visual style */
  htmlContent: string;
  /** Viewport dimensions the template targets */
  dimensions: {
    width: number;
    height: number;
  };
  createdAt: Date;
  updatedAt: Date;
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
  /** Media content — single image/video OR multi-image carousel */
  content?: {
    media?: {
      /** LinkedIn asset URN (from upload API) */
      id: string;
      /** Alt text for the media */
      altText?: string;
    };
    multiImage?: {
      images: Array<{
        id: string;
        altText?: string;
      }>;
    };
  };
}

/**
 * Response from LinkedIn's registerUpload endpoint.
 * Used to get the upload URL and asset URN for media posts.
 */
export interface LinkedInUploadResponse {
  /** The unique asset URN (e.g. "urn:li:image:abc123") */
  value: {
    asset: string;
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        headers: Record<string, string>;
        uploadUrl: string;
      };
    };
  };
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

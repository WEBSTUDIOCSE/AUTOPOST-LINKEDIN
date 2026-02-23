/**
 * LinkedIn OAuth 2.0 Configuration
 *
 * Handles the full OAuth flow to connect a user's LinkedIn account.
 * Uses the "Sign In with LinkedIn using OpenID Connect" product +
 * the "Share on LinkedIn" / "w_member_social" scope for post creation.
 *
 * Required env vars (server-only — never expose to client):
 *   LINKEDIN_CLIENT_ID
 *   LINKEDIN_CLIENT_SECRET
 *   LINKEDIN_REDIRECT_URI   e.g. https://yourapp.com/api/linkedin/callback
 *
 * @see https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_POSTS_URL = 'https://api.linkedin.com/rest/posts';
const LINKEDIN_IMAGES_URL = 'https://api.linkedin.com/rest/images';
const LINKEDIN_VIDEOS_URL = 'https://api.linkedin.com/rest/videos';

/** Scopes required for posting + reading basic profile */
const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

function getClientId(): string {
  const id = process.env.LINKEDIN_CLIENT_ID;
  if (!id) throw new Error('LINKEDIN_CLIENT_ID environment variable is not set');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!secret) throw new Error('LINKEDIN_CLIENT_SECRET environment variable is not set');
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.LINKEDIN_REDIRECT_URI;
  if (!uri) throw new Error('LINKEDIN_REDIRECT_URI environment variable is not set');
  return uri;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OAUTH FLOW
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the URL the browser should redirect to in order to start the
 * LinkedIn OAuth consent flow.
 *
 * @param state  CSRF state parameter — generate a random string, store it
 *               in the session/cookie, and verify it in the callback.
 */
export function getLinkedInAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(' '),
    state,
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/** Tokens returned by LinkedIn after a successful code exchange */
export interface LinkedInTokens {
  accessToken: string;
  expiresIn: number;          // seconds (usually 5184000 = 60 days)
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
}

/**
 * Exchange the authorization `code` from the callback URL for access +
 * refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<LinkedInTokens> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
    refreshTokenExpiresIn: data.refresh_token_expires_in,
  };
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<LinkedInTokens> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token ?? refreshToken,
    refreshTokenExpiresIn: data.refresh_token_expires_in,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

import type { LinkedInProfile } from './types';

/**
 * Fetch the authenticated user's basic profile (name, email, picture, sub).
 * Uses the OpenID Connect `userinfo` endpoint.
 */
export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`LinkedIn profile fetch failed (${res.status})`);
  }

  return res.json() as Promise<LinkedInProfile>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE POST (text, image, or video)
// ═══════════════════════════════════════════════════════════════════════════════

import type { LinkedInCreatePostPayload, PostMediaType } from './types';

interface CreatePostOptions {
  accessToken: string;
  authorUrn: string;          // "urn:li:person:abc123"
  text: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  /** Type of media to attach */
  mediaType?: PostMediaType;
  /** LinkedIn media asset URN (single image/video) */
  mediaAssetUrn?: string;
  /** LinkedIn media asset URNs (multi-image carousel) */
  mediaAssetUrns?: string[];
  /** Alt text for the media */
  mediaAltText?: string;
}

/**
 * Publish a post to LinkedIn via the Posts API (v2).
 * Supports text-only, image, and video posts.
 *
 * @returns The `x-restli-id` header value — the LinkedIn post URN.
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 */
export async function createLinkedInPost(opts: CreatePostOptions): Promise<string> {
  const payload: LinkedInCreatePostPayload = {
    author: opts.authorUrn,
    commentary: opts.text,
    visibility: opts.visibility ?? 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  // Attach media if provided
  if (opts.mediaAssetUrns && opts.mediaAssetUrns.length > 1 && (opts.mediaType === 'image' || opts.mediaType === 'html')) {
    // Multi-image carousel post
    payload.content = {
      multiImage: {
        images: opts.mediaAssetUrns.map(urn => ({
          id: urn,
          altText: opts.mediaAltText,
        })),
      },
    };
  } else if (opts.mediaAssetUrn && opts.mediaType && opts.mediaType !== 'text') {
    payload.content = {
      media: {
        id: opts.mediaAssetUrn,
        altText: opts.mediaAltText,
      },
    };
  }

  const res = await fetch(LINKEDIN_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202601',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn create post failed (${res.status}): ${text}`);
  }

  // The post ID is returned in the x-restli-id header
  const postId = res.headers.get('x-restli-id');
  if (!postId) {
    throw new Error('LinkedIn did not return a post ID');
  }

  return postId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════

interface ImageUploadResult {
  /** The image asset URN to use in the post payload */
  imageUrn: string;
}

/**
 * Upload an image to LinkedIn and get the asset URN.
 *
 * LinkedIn's image upload flow (v2):
 * 1. Initialize upload → get uploadUrl + image URN
 * 2. PUT the binary image to the uploadUrl
 * 3. Use the image URN in the post's `content.media.id`
 *
 * @param accessToken - LinkedIn OAuth access token
 * @param authorUrn   - "urn:li:person:abc123"
 * @param imageData   - Image as Buffer (binary)
 * @param mimeType    - e.g. 'image/png', 'image/jpeg'
 * @returns The image URN for use in post creation
 *
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
 */
export async function uploadImageToLinkedIn(
  accessToken: string,
  authorUrn: string,
  imageData: Buffer,
): Promise<ImageUploadResult> {
  // Step 1: Initialize upload
  const initRes = await fetch(`${LINKEDIN_IMAGES_URL}?action=initializeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202601',
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn,
      },
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`LinkedIn image upload init failed (${initRes.status}): ${text}`);
  }

  const initData = await initRes.json() as {
    value: { uploadUrl: string; image: string };
  };

  const { uploadUrl, image: imageUrn } = initData.value;

  // Step 2: Upload the binary image
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(imageData),
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`LinkedIn image binary upload failed (${uploadRes.status}): ${text}`);
  }

  return { imageUrn };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO UPLOAD
// ═══════════════════════════════════════════════════════════════════════════════

interface VideoUploadResult {
  /** The video asset URN to use in the post payload */
  videoUrn: string;
}

/**
 * Upload a video to LinkedIn and get the asset URN.
 *
 * LinkedIn's video upload flow (v2):
 * 1. Initialize upload → get uploadUrl(s) + video URN
 * 2. PUT the binary video to each uploadUrl (single part for < 200MB)
 * 3. Finalize the upload
 * 4. Use the video URN in the post's `content.media.id`
 *
 * @param accessToken - LinkedIn OAuth access token
 * @param authorUrn   - "urn:li:person:abc123"
 * @param videoData   - Video as Buffer (binary)
 * @param mimeType    - e.g. 'video/mp4'
 * @returns The video URN for use in post creation
 *
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api
 */
export async function uploadVideoToLinkedIn(
  accessToken: string,
  authorUrn: string,
  videoData: Buffer,
): Promise<VideoUploadResult> {
  // Step 1: Initialize upload
  const initRes = await fetch(`${LINKEDIN_VIDEOS_URL}?action=initializeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202601',
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn,
        fileSizeBytes: videoData.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`LinkedIn video upload init failed (${initRes.status}): ${text}`);
  }

  const initData = await initRes.json() as {
    value: {
      uploadInstructions: Array<{ uploadUrl: string; firstByte: number; lastByte: number }>;
      video: string;
    };
  };

  const { uploadInstructions, video: videoUrn } = initData.value;

  // Step 2: Upload the binary video (single part — works for files < 200MB)
  // For larger files, you'd need to split into chunks per uploadInstructions
  for (const instruction of uploadInstructions) {
    const chunk = new Uint8Array(videoData.subarray(instruction.firstByte, instruction.lastByte + 1));
    const uploadRes = await fetch(instruction.uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': chunk.length.toString(),
      },
      body: chunk,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`LinkedIn video chunk upload failed (${uploadRes.status}): ${text}`);
    }
  }

  // Step 3: Finalize the upload
  const finalizeRes = await fetch(`${LINKEDIN_VIDEOS_URL}?action=finalizeUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202601',
    },
    body: JSON.stringify({
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken: '',
        uploadedPartIds: [],
      },
    }),
  });

  if (!finalizeRes.ok) {
    const text = await finalizeRes.text();
    throw new Error(`LinkedIn video finalize failed (${finalizeRes.status}): ${text}`);
  }

  return { videoUrn };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD MEDIA (helper to fetch AI-generated media as Buffer)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download media from a URL and return it as a Buffer.
 * Used to bridge AI-generated media URLs to LinkedIn's binary upload.
 */
export async function downloadMediaAsBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download media from ${url} (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

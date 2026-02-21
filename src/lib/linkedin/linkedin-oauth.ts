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
// CREATE POST
// ═══════════════════════════════════════════════════════════════════════════════

import type { LinkedInCreatePostPayload } from './types';

interface CreatePostOptions {
  accessToken: string;
  authorUrn: string;          // "urn:li:person:abc123"
  text: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}

/**
 * Publish a text post to LinkedIn via the Posts API (v2).
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

  const res = await fetch(LINKEDIN_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202402',
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

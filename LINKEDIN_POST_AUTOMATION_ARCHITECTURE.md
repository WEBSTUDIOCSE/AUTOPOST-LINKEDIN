# 🚀 LinkedIn Post Automation - Architecture & Implementation Plan

## Executive Summary

Building a **LinkedIn Post Automation Platform** on top of your existing Next.js 16 + Firebase infrastructure. This document covers the architectural decisions, how it integrates with your current auth system, and the implementation roadmap.

---

## 📋 Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [LinkedIn Post Automation Architecture](#linkedin-post-automation-architecture)
3. [Auth Integration Strategy](#auth-integration-strategy)
4. [System Components](#system-components)
5. [Data Models](#data-models)
6. [File Structure](#file-structure)
7. [Implementation Phases](#implementation-phases)
8. [Security Considerations](#security-considerations)
9. [Database Schema](#database-schema)

---

## 🏛️ Current Architecture Analysis

### Your Existing Setup ✅

```
Authentication Layer:
├── Client-side: Firebase Auth (email + Google OAuth)
├── Server-side: Session-based (cookies)
├── Middleware: Next.js proxy.ts for route protection
└── Services: APIBook pattern (AuthService, PaymentService)

Environment Management:
├── UAT: env-uat-cd3c5 (Firebase project)
├── PROD: breathe-free-c1566 (Firebase project)
└── Switch: IS_PRODUCTION boolean flag

Data Flow:
├── User login → Firebase auth
├── Token sync → API route /api/auth/session
├── Cookie set → httpOnly, secure, 7-day expiry
├── Server access → getCurrentUser() via cookies
└── Route protection → Proxy.ts checks session
```

### Key Strengths to Leverage 💪

1. **Hybrid Auth Model**: Client-side Firebase + server-side cookies (perfect for OAuth extensions)
2. **Environment Switching**: Easy UAT/PROD toggle for different LinkedIn Apps
3. **APIBook Pattern**: Clean service layer for adding new integrations
4. **Type-Safe**: Strong TypeScript throughout
5. **Token Management**: Already handling token lifecycle (could extend for OAuth tokens)

### What We'll Extend 🔧

Instead of replacing Firebase, we'll **layer LinkedIn OAuth on top**:
- Keep Firebase for user identity
- Add LinkedIn OAuth for post publishing permissions
- Store LinkedIn tokens securely in Firestore
- Create LinkedIn service layer following your existing patterns

---

## 🎯 LinkedIn Post Automation Architecture

### High-Level Flow

```
User Journey:
┌─────────────────┐
│  User Signs In  │ (Firebase Auth - already done)
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Redirect to LinkedIn OAuth Consent       │
│  (Request: w_member_social permission)   │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Store LinkedIn Access Token Securely    │
│  (In Firestore + Refresh Token cache)    │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  Post Automation Dashboard               │
│  ├── New Post (Topic input)              │
│  ├── AI Content Generation (OpenAI)      │
│  ├── Review & Edit Interface             │
│  └── Publish to LinkedIn                 │
└────────┬─────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  LinkedIn REST API (Posts endpoint)      │
│  POST /v2/posts → user's timeline        │
└──────────────────────────────────────────┘
```

### Architectural Diagram

```
NEXT.JS FRONTEND
├── Pages
│   ├── /dashboard (public, auth-protected)
│   ├── /linkedin/connect (LinkedIn OAuth callback)
│   ├── /posts/new (create post page)
│   ├── /posts (list drafts & published)
│   └── /posts/[id] (edit/review post)
│
├── Components
│   ├── LinkedInConnect (OAuth button)
│   ├── ContentGenerator (topic → AI)
│   ├── PostEditor (review & edit)
│   ├── PostPublisher (LinkedIn integration)
│   └── PostHistoryList (all posts)
│
└── Contexts
    ├── AuthContext (existing - Firebase)
    └── LinkedInContext (new - LinkedIn status)

API ROUTES
├── /api/auth/session (existing - Firebase session)
├── /api/linkedin/connect (new - OAuth callback)
├── /api/linkedin/disconnect (revoke token)
├── /api/posts/generate (OpenAI integration)
├── /api/posts/save (Firestore)
├── /api/posts/publish (LinkedIn REST API)
└── /api/posts/list (get user's posts)

SERVICES LAYER (APIBook)
├── AuthService (existing - Firebase)
├── LinkedInService (new)
│   ├── getAuthUrl() → OAuth consent screen
│   ├── exchangeCode() → access token
│   ├── saveToken() → Firestore
│   ├── getToken() → from Firestore
│   └── publishPost() → LinkedIn API
├── PostService (new)
│   ├── generateContent() → OpenAI
│   ├── saveDraft() → Firestore
│   ├── updateDraft() → Firestore
│   └── deleteDraft() → Firestore
└── PaymentService (existing)

DATABASE (Firestore)
├── users/{userId}
│   ├── profile (existing)
│   ├── linkedinToken (new)
│   │   ├── accessToken
│   │   ├── refreshToken
│   │   ├── expiresAt
│   │   └── memberId
│   └── linkedinProfile (new)
│       ├── name
│       ├── profilePicture
│       └── lastSyncedAt
│
└── posts/{userId}/drafts/{postId}
    ├── topic
    ├── content
    ├── generatedBy (openai)
    ├── status (draft/published)
    ├── linkedInPostId
    ├── createdAt
    ├── publishedAt
    └── metadata
```

---

## 🔐 Auth Integration Strategy

### Why Your Current Setup is Perfect

Your existing auth flow handles the **identity layer**:
```typescript
// Current flow (stays the same)
User Email/Password or Google OAuth
        ↓
Firebase Auth (creates JWT)
        ↓
AuthProvider syncs to cookies
        ↓
Proxy.ts protects routes
```

### Adding LinkedIn OAuth (Extension, not replacement)

```typescript
// New flow (LinkedIn layer)
User clicks "Connect LinkedIn"
        ↓
Redirect to LinkedIn OAuth consent
        ↓
User grants "w_member_social" permission
        ↓
LinkedIn returns authorization_code
        ↓
/api/linkedin/connect route
  - Exchange code for access_token
  - Store token securely in Firestore
  - Set flag in user doc: linkedinConnected = true
        ↓
PostDashboard shows "Connected ✓"
```

### Key Differences from Firebase OAuth

| Aspect | Firebase OAuth | LinkedIn OAuth |
|--------|---|---|
| **Purpose** | User identity | Publishing permission |
| **Token Type** | ID Token (stateless) | Access Token (needs refresh) |
| **Storage** | In-memory (AuthProvider) | Firestore (secure storage) |
| **Refresh** | Automatic via SDK | Manual via refresh_token |
| **Scopes** | profile, email | w_member_social |
| **What we use** | UID for user record | memberId for posts |

### Implementation Approach

```typescript
// STEP 1: Create LinkedIn Service (following your APIBook pattern)
// src/lib/linkedin/linkedin.service.ts

export const LinkedInService = {
  // 1. Generate OAuth consent URL
  getAuthUrl: async (): Promise<string> => {
    const params = {
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      scope: 'w_member_social', // The permission we need
      state: generateSecureState() // CSRF prevention
    };
    return `https://www.linkedin.com/oauth/v2/authorization?${queryString(params)}`;
  },

  // 2. Exchange code for access token (called from /api/linkedin/connect)
  exchangeCode: async (code: string): Promise<LinkedInToken> => {
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: queryString({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      })
    });
    return response.json();
  },

  // 3. Store token securely
  saveToken: async (userId: string, token: LinkedInToken): Promise<void> => {
    await setDoc(doc(db, 'users', userId), {
      linkedinToken: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + (token.expires_in * 1000),
        memberId: token.something_else // LinkedIn returns member info
      },
      linkedinConnected: true,
      linkedinConnectedAt: serverTimestamp()
    }, { merge: true });
  },

  // 4. Publish a post to LinkedIn
  publishPost: async (userId: string, postContent: string): Promise<string> => {
    const token = await getLinkedInToken(userId);
    
    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.accessToken}`,
        'LinkedIn-Version': '202401',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        author: `urn:li:person:${token.memberId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postContent
            },
            shareMediaCategory: 'ARTICLE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      })
    });

    return response.json().id; // LinkedIn post ID
  }
};

// STEP 2: Create API route for OAuth callback
// src/app/api/linkedin/connect/route.ts

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  try {
    // Verify CSRF state
    const savedState = request.cookies.get('linkedin_state')?.value;
    if (state !== savedState) throw new Error('State mismatch');

    // Get current user
    const user = await getCurrentUser();
    if (!user) return redirect('/login');

    // Exchange code for token
    const token = await LinkedInService.exchangeCode(code);

    // Save token to Firestore
    await LinkedInService.saveToken(user.uid, token);

    // Redirect to dashboard
    return redirect('/dashboard?linkedin=connected');
  } catch (error) {
    return redirect('/dashboard?error=linkedin_auth_failed');
  }
}

// STEP 3: Update AuthProvider to sync LinkedIn status
// src/contexts/AuthContext.tsx

export const AuthProvider = ({ children }) => {
  // ... existing Firebase auth code ...

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check LinkedIn connection status
        const userDoc = doc(db, 'users', user.uid);
        const userData = await getDoc(userDoc);
        
        setLinkedInConnected(userData?.data()?.linkedinConnected ?? false);
      }
    });
  }, []);
  
  // ...
};
```

---

## 🧩 System Components

### 1. **LinkedIn Connect Screen**

```typescript
// src/components/linkedin/LinkedInConnect.tsx

'use client';

import { useState } from 'react';
import { LinkedInService } from '@/lib/linkedin/linkedin.service';

export function LinkedInConnect({ isConnected }: { isConnected: boolean }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const authUrl = await LinkedInService.getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to connect LinkedIn:', error);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-4">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="text-green-700">LinkedIn Connected</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
    >
      <Linkedin className="w-5 h-5" />
      {isLoading ? 'Connecting...' : 'Connect LinkedIn'}
    </button>
  );
}
```

### 2. **Content Generator (Topic → AI)**

```typescript
// src/lib/ai/openai.service.ts

export const OpenAIService = {
  generatePost: async (topic: string): Promise<string> => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional LinkedIn content writer. 
                     Generate engaging, authentic LinkedIn posts about the given topic.
                     Make it valuable, industry-relevant, and conversation-starting.
                     Keep it under 300 characters initially (can be expanded).
                     Use emojis sparingly and professionally.`
          },
          {
            role: 'user',
            content: `Generate a LinkedIn post about: ${topic}`
          }
        ],
        temperature: 0.8,
        max_tokens: 300
      })
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }
};
```

### 3. **Post Editor & Review**

```typescript
// src/components/linkedin/PostEditor.tsx

'use client';

export function PostEditor({ 
  initialContent, 
  onPublish 
}: PostEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isPublishing, setIsPublishing] = useState(false);
  const [charCount, setCharCount] = useState(content.length);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await fetch('/api/posts/publish', {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setCharCount(e.target.value.length);
          }}
          maxLength="3000"
          className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          rows={8}
          placeholder="Edit your LinkedIn post..."
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {charCount} / 3000
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handlePublish}
          disabled={isPublishing || !content.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
        >
          {isPublishing ? 'Publishing...' : 'Publish to LinkedIn'}
        </button>
        <button
          onClick={() => setContent(initialContent)}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
```

### 4. **Post Publishing Flow**

```typescript
// src/app/api/posts/publish/route.ts

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const { content, draftId } = await request.json();

    // 1. Validate user has LinkedIn connected
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.data()?.linkedinConnected) {
      return json({ error: 'LinkedIn not connected' }, { status: 403 });
    }

    // 2. Publish to LinkedIn
    const linkedinPostId = await LinkedInService.publishPost(user.uid, content);

    // 3. Save record in Firestore
    const postRef = doc(
      db, 
      'posts', 
      user.uid, 
      'published', 
      linkedinPostId
    );

    await setDoc(postRef, {
      content,
      linkedinPostId,
      draftId,
      publishedAt: serverTimestamp(),
      status: 'published',
      likes: 0,
      comments: 0
    });

    // 4. Delete draft if exists
    if (draftId) {
      await deleteDoc(doc(db, 'posts', user.uid, 'drafts', draftId));
    }

    return json({ success: true, postId: linkedinPostId });
  } catch (error) {
    console.error('Publish error:', error);
    return json({ error: 'Failed to publish' }, { status: 500 });
  }
}
```

---

## 📊 Data Models

### Firestore Collections Structure

```typescript
// User Document
users/{userId}
├── // Existing fields
│   ├── uid
│   ├── email
│   ├── displayName
│   ├── photoURL
│   ├── emailVerified
│   ├── createdAt
│   └── lastLoginAt
│
├── // New LinkedIn fields
│   ├── linkedinConnected: boolean
│   ├── linkedinConnectedAt: timestamp
│   ├── linkedinToken: {
│   │   ├── accessToken: string (encrypted in prod)
│   │   ├── refreshToken: string (encrypted)
│   │   ├── expiresAt: timestamp
│   │   ├── memberId: string
│   │   └── encryptionMetadata: object
│   │
│   └── linkedinProfile: {
│       ├── name: string
│       ├── profileUrl: string
│       ├── profilePicture: string
│       ├── headlines: string[]
│       └── lastFetchedAt: timestamp
│
├── // Post Drafts
└── posts/{userId}/
    ├── drafts/{postId}
    │   ├── topic: string
    │   ├── content: string
    │   ├── generationModel: string (e.g., 'gpt-4')
    │   ├── generationPrompt: string
    │   ├── status: 'draft'
    │   ├── createdAt: timestamp
    │   ├── updatedAt: timestamp
    │   ├── metadata: {
    │   │   ├── wordCount: number
    │   │   ├── charCount: number
    │   │   ├── aiQualityScore: number
    │   │   └── suggestedBestTimeToPost: timestamp
    │   │
    │   └── versions: [
    │       {
    │         content: string,
    │         createdAt: timestamp,
    │         description?: string
    │       }
    │     ]
    │
    ├── published/{linkedinPostId}
    │   ├── content: string
    │   ├── linkedinPostId: string
    │   ├── linkedinUrl: string
    │   ├── draftId: string (reference to original draft)
    │   ├── publishedAt: timestamp
    │   ├── status: 'published'
    │   ├── analytics: {
    │   │   ├── likes: number
    │   │   ├── comments: number
    │   │   ├── reposts: number
    │   │   ├── views: number
    │   │   └── lastUpdatedAt: timestamp
    │   │
    │   └── engagementHistory: [
    │       {
    │         timestamp: timestamp,
    │         likes: number,
    │         comments: number,
    │         reposts: number
    │       }
    │     ]
    │
    └── history/
        └── {postId}
            └── Similar to published posts
```

### TypeScript Interfaces

```typescript
// src/lib/linkedin/linkedin.types.ts

export interface LinkedInToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  memberId: string;
}

export interface LinkedInProfile {
  name: string;
  profileUrl: string;
  profilePicture?: string;
  headline?: string;
  lastFetchedAt: number;
}

export interface PostDraft {
  id: string;
  userId: string;
  topic: string;
  content: string;
  generationModel: 'gpt-4' | 'gpt-3.5-turbo';
  generationPrompt: string;
  status: 'draft';
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    wordCount: number;
    charCount: number;
    aiQualityScore?: number;
  };
  versions: PostVersion[];
}

export interface PostPublished {
  linkedinPostId: string;
  content: string;
  linkedinUrl: string;
  draftId?: string;
  publishedAt: Date;
  status: 'published';
  analytics: PostAnalytics;
}

export interface PostAnalytics {
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  lastUpdatedAt: Date;
}

export interface PostVersion {
  content: string;
  createdAt: Date;
  description?: string;
}
```

---

## 📁 File Structure

```
src/
├── app/
│   ├── (protected)/
│   │   ├── dashboard/
│   │   │   └── page.tsx (main dashboard)
│   │   ├── posts/
│   │   │   ├── page.tsx (list all posts)
│   │   │   ├── layout.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx (create new post)
│   │   │   └── [id]/
│   │   │       ├── page.tsx (view/edit post)
│   │   │       └── preview/
│   │   │           └── page.tsx (preview before publish)
│   │   └── settings/
│   │       └── linkedin/
│   │           └── page.tsx (LinkedIn connection settings)
│   │
│   └── api/
│       ├── linkedin/
│       │   ├── connect/
│       │   │   └── route.ts (OAuth callback)
│       │   ├── disconnect/
│       │   │   └── route.ts (revoke token)
│       │   ├── profile/
│       │   │   └── route.ts (fetch LinkedIn profile)
│       │   └── refresh/
│       │       └── route.ts (refresh access token)
│       │
│       └── posts/
│           ├── generate/
│           │   └── route.ts (OpenAI call)
│           ├── save/
│           │   └── route.ts (save draft)
│           ├── publish/
│           │   └── route.ts (publish to LinkedIn)
│           ├── list/
│           │   └── route.ts (get posts)
│           └── [id]/
│               ├── route.ts (get/update/delete)
│               └── analytics/
│                   └── route.ts (fetch LinkedIn analytics)
│
├── components/
│   ├── linkedin/
│   │   ├── LinkedInConnect.tsx
│   │   ├── LinkedInProfile.tsx
│   │   └── LinkedInDisconnect.tsx
│   │
│   └── posts/
│       ├── PostGenerator.tsx (topic input → AI)
│       ├── PostEditor.tsx (review & edit)
│       ├── PostPreview.tsx (preview before publish)
│       ├── PostPublisher.tsx (publish button & confirmation)
│       ├── PostHistoryList.tsx (all posts)
│       └── PostCard.tsx (single post preview)
│
├── contexts/
│   ├── AuthContext.tsx (existing + LinkedIn status)
│   └── LinkedInContext.tsx (new - LinkedIn connection state)
│
├── lib/
│   ├── firebase/ (existing)
│   │   └── services/
│   │       └── index.ts (extend APIBook)
│   │
│   ├── linkedin/ (new)
│   │   ├── linkedin.service.ts (OAuth, publishing, etc.)
│   │   ├── linkedin.types.ts (interfaces)
│   │   └── linkedin-token.utils.ts (encryption, refresh)
│   │
│   ├── ai/ (new)
│   │   ├── openai.service.ts (content generation)
│   │   └── openai.types.ts
│   │
│   └── posts/ (new)
│       ├── posts.service.ts (CRUD operations)
│       └── posts.types.ts
│
└── hooks/ (new)
    ├── useLinkedIn.ts
    ├── usePostGeneration.ts
    └── usePostPublish.ts
```

---

## 🚀 Implementation Phases

### Phase 1: LinkedIn OAuth Integration (Week 1-2)
**Goal**: Securely connect LinkedIn accounts

- [ ] Register LinkedIn OAuth app (get Client ID, Secret)
- [ ] Create `LinkedInService` with OAuth flow
- [ ] Build `/api/linkedin/connect` route
- [ ] Create `LinkedInConnect` component
- [ ] Add `linkedinConnected` field to Firestore user document
- [ ] Store LinkedIn tokens securely (with encryption in prod)
- [ ] Test OAuth flow in UAT environment

**Files to create**:
```typescript
✓ src/lib/linkedin/linkedin.service.ts
✓ src/lib/linkedin/linkedin.types.ts
✓ src/lib/linkedin/linkedin-token.utils.ts (encryption)
✓ src/app/api/linkedin/connect/route.ts
✓ src/components/linkedin/LinkedInConnect.tsx
✓ src/contexts/LinkedInContext.tsx
```

### Phase 2: Content Generation (Week 2-3)
**Goal**: Generate AI posts from user topics

- [ ] Set up OpenAI API integration
- [ ] Create `OpenAIService` for content generation
- [ ] Build `/api/posts/generate` route
- [ ] Create `PostGenerator` component (topic input)
- [ ] Design draft storage in Firestore
- [ ] Add version history for posts
- [ ] Test generation with various topics

**Files to create**:
```typescript
✓ src/lib/ai/openai.service.ts
✓ src/lib/ai/openai.types.ts
✓ src/lib/posts/posts.service.ts
✓ src/lib/posts/posts.types.ts
✓ src/app/api/posts/generate/route.ts
✓ src/app/api/posts/save/route.ts
✓ src/components/posts/PostGenerator.tsx
✓ src/app/(protected)/posts/new/page.tsx
```

### Phase 3: Post Management (Week 3-4)
**Goal**: Review, edit, and manage drafts

- [ ] Build post editor UI
- [ ] Create draft list view
- [ ] Add edit/delete functionality
- [ ] Build post preview component
- [ ] Add version history view
- [ ] Implement post analytics fetching
- [ ] Create draft-to-publish workflow

**Files to create**:
```typescript
✓ src/components/posts/PostEditor.tsx
✓ src/components/posts/PostPreview.tsx
✓ src/components/posts/PostHistoryList.tsx
✓ src/app/(protected)/posts/page.tsx
✓ src/app/(protected)/posts/[id]/page.tsx
✓ src/hooks/usePostGeneration.ts
✓ src/hooks/usePostPublish.ts
```

### Phase 4: LinkedIn Publishing (Week 4-5)
**Goal**: Publish posts directly to LinkedIn

- [ ] Implement LinkedIn REST API integration
- [ ] Create `/api/posts/publish` route
- [ ] Build publish confirmation flow
- [ ] Store published post metadata
- [ ] Add success/error handling
- [ ] Implement rate limiting
- [ ] Add post URL tracking

**Files to create**:
```typescript
✓ src/app/api/posts/publish/route.ts
✓ src/components/posts/PostPublisher.tsx
✓ src/app/(protected)/posts/[id]/preview/page.tsx
```

### Phase 5: Analytics & Scheduling (Week 5-6)
**Goal**: Track post performance and schedule posts

- [ ] Fetch post analytics from LinkedIn
- [ ] Create analytics dashboard
- [ ] Implement post scheduling (with cron job)
- [ ] Add best time to post suggestions
- [ ] Build analytics view component
- [ ] Add engagement tracking over time

**Files to create**:
```typescript
✓ src/app/api/posts/[id]/analytics/route.ts
✓ src/components/posts/PostAnalytics.tsx
✓ src/app/(protected)/posts/[id]/analytics/page.tsx
✓ src/lib/scheduling/scheduler.ts
```

---

## 🔒 Security Considerations

### 1. **Token Storage** ⚠️ CRITICAL
```typescript
// NEVER store tokens in localStorage or cookies visible to frontend
// Use encrypted Firestore + httpOnly cookies for refresh tokens

// Approach:
// ✓ Access token: Short-lived (1 hour), stored server-side only
// ✓ Refresh token: Longer-lived, in httpOnly Firestore reference
// ✓ Never expose tokens to client JavaScript

export async function encryptToken(token: string, userId: string): Promise<string> {
  const crypto = require('crypto');
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), IV);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return encrypted;
}
```

### 2. **OAuth Security**
```typescript
// CSRF Protection
✓ Use `state` parameter
✓ Store state in secure httpOnly cookie
✓ Verify state matches on callback

// Code Validation
✓ Authorization code expires in 10 minutes
✓ Use code only once
✓ Exchange code immediately (don't store)

// Scopes
✓ Request minimum required: w_member_social
✓ Never request more permissions than needed
```

### 3. **API Rate Limiting**
```typescript
// Implement rate limiting on sensitive endpoints
/api/posts/publish → Max 5 posts per day
/api/posts/generate → Max 10 generations per day (OpenAI costs)
/api/linkedin/connect → Max 3 attempts per 15 minutes
```

### 4. **Data Validation**
```typescript
// Always validate inputs
✓ Post content: max 3000 chars, xss sanitization
✓ Topic input: max 500 chars
✓ OAuth code: must match pattern

export const generatePostSchema = z.object({
  topic: z.string().min(3).max(500).trim(),
  tone: z.enum(['professional', 'casual', 'inspirational']).optional(),
  includeHashtags: z.boolean().optional(),
});
```

---

## 🗄️ Database Schema

### Firestore Security Rules (Start Simple)

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      
      // Protect sensitive fields
      match /{document=**} {
        allow read: if request.auth.uid == userId;
        allow write: if request.auth.uid == userId && 
                       !request.resource.data.linkedinToken;
      }
    }

    // Posts belong to users
    match /posts/{userId}/{collection}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### Environment Variables Needed

```bash
# Firebase (existing)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/api/linkedin/connect

# OpenAI
OPENAI_API_KEY=sk-...

# Security
TOKEN_ENCRYPTION_KEY=32-char-hex-key
```

---

## 📊 Summary: Current Architecture Extensions

| Layer | Current | Adding |
|-------|---------|--------|
| **Authentication** | Firebase (email + Google) | + LinkedIn OAuth |
| **Token Management** | In-memory tokens | + Secure storage in Firestore |
| **Services** | AuthService, PaymentService | + LinkedInService, PostService |
| **API Routes** | /api/auth/session | + /api/linkedin/*, /api/posts/* |
| **Components** | Auth forms | + Post generator, editor, publisher |
| **Database** | Users + payments | + LinkedIn tokens + Posts |
| **Context** | AuthContext | + LinkedInContext |
| **Environments** | UAT/PROD toggle | Same setup (register apps in both) |

---

## ✅ Next Steps

1. **Validate this architecture** with your team
2. **Register LinkedIn OAuth apps** in UAT and PROD
3. **Set up OpenAI API** account and get API key
4. **Create environment variables** locally
5. **Start Phase 1**: LinkedIn OAuth integration
6. **Weekly checkpoints** to review progress

---

## 📚 References & Resources

- [LinkedIn OAuth 2.0 Docs](https://learn.microsoft.com/en-us/linkedin/shared/oauth-v2/oauth-v2-overview)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)

---

**Architecture Document v1.0**
Last Updated: February 19, 2026

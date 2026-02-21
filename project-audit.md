# Project Audit: LinkedIn Post Automation Platform

> **Audited by:** Senior DevSecOps Engineer + Next.js Expert  
> **Date:** February 21, 2026  
> **Next.js Version:** 16.1.6 · **React:** 19.2.4 · **Firebase Client:** 12.2.1 · **Firebase Admin:** 13.6.1  
> **Standards Referenced:** Next.js 16 Official Auth Guide, OWASP NodeJS Security Cheat Sheet, Firebase Security Rules Docs, Firebase App Check Docs  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Integration](#2-architecture--integration)
3. [Component & Data Flow](#3-component--data-flow)
4. [Security Audit vs. Production Standards](#4-security-audit-vs-production-standards)
5. [Code Rating & Final Verdict](#5-code-rating--final-verdict)

---

## 1. Project Overview

### Purpose
A **full-stack LinkedIn post automation SaaS** built on Next.js 16 (App Router). Users log in via Firebase Authentication, optionally pay via PayU, and interact with AI models (Gemini, KieAI) to generate content. The app is a Progressive Web App (PWA) with dual-environment support (UAT / Production).

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, Radix UI, shadcn/ui |
| Authentication | Firebase Auth (client SDK v12) + Firebase Admin SDK v13 |
| Database | Cloud Firestore (env-switched: `uat_users` / `prod_users`) |
| AI Adapters | Google Gemini (`@google/genai`) + KieAI (custom REST adapter) |
| Payment | PayU payment gateway |
| Forms | React Hook Form v7 + Zod v4 |
| PWA | `@ducanh2912/next-pwa` |
| Language | TypeScript 5 (strict mode) |

---

## 2. Architecture & Integration

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  React 19 Client Components                                     │
│  ├── AuthContext (Firebase onAuthStateChanged + token refresh)  │
│  ├── LoginForm / SignupForm (React Hook Form + Zod)             │
│  └── PaymentForm / DynamicPaymentForm                           │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP(S) — fetch / form submissions
┌────────────────────▼────────────────────────────────────────────┐
│                   NEXT.JS 16 SERVER (Edge/Node)                 │
│                                                                 │
│  src/proxy.ts  ──────────────────── Route guard (cookie check) │
│                                                                 │
│  App Router — Server Components                                 │
│  ├── (auth)/ layout + pages   ← No auth required              │
│  └── (protected)/ layout + pages ← getCurrentUser() called    │
│                                                                 │
│  API Routes                                                     │
│  ├── /api/auth/session  (POST/DELETE) ← CSRF + Admin SDK       │
│  ├── /api/ai/test       (POST)        ← Auth + safety filters  │
│  ├── /api/payment/initiate (POST)     ← Hash generation        │
│  ├── /api/payment/success  (POST)     ← PayU callback          │
│  ├── /api/payment/failure  (POST)     ← PayU callback          │
│  └── /api/payment/verify   (POST)     ← Hash verification      │
└──────┬───────────────────────────┬───────────────────────────┬──┘
       │                           │                           │
┌──────▼──────┐          ┌─────────▼────────┐      ┌──────────▼──┐
│  Firebase   │          │   AI Adapters    │      │    PayU     │
│  Admin SDK  │          │  ┌────────────┐  │      │  Gateway    │
│  verifyId   │          │  │ Gemini     │  │      │ (External)  │
│  Token()    │          │  │ KieAI      │  │      └─────────────┘
└──────┬──────┘          │  └────────────┘  │
       │                 │  + RateLimiter   │
┌──────▼──────┐          │  + CircuitBreaker│
│  Firestore  │          │  + PromptSafety  │
│  (UAT/Prod) │          │  + AuditLogger   │
└─────────────┘          └──────────────────┘
```

### 2.2 Authentication Integration

The authentication system follows a **dual-layer verification model**:

**Layer 1 — Proxy (Optimistic):**  
`src/proxy.ts` runs before every page render in Next.js 16. It performs a fast, cookie-only check for the presence of the `firebaseAuthToken` cookie. This is an optimistic guard — it does *not* verify the JWT signature. Its purpose is to redirect unauthenticated users quickly without hitting the database.

**Layer 2 — Server-side (Cryptographic):**  
`src/lib/auth/server.ts` exports `getCurrentUser()`, wrapped in React's `cache()`. Any Server Component or API Route that needs a verified user calls this function. It reads the `firebaseAuthToken` cookie and passes it to `getAdminAuth().verifyIdToken(token, checkRevoked: true)` via the Firebase Admin SDK. This performs cryptographic RSA signature verification against Google's public keys and checks if the token has been revoked.

**Layer 3 — Session Route:**  
`/api/auth/session` is the bridge between the client's Firebase ID token and the server's httpOnly cookie. It validates Origin/Referer headers for CSRF protection, then re-verifies the token with the Admin SDK before persisting it as an httpOnly cookie.

**Session Model:**
```
Firebase ID Token (1hr expiry) → httpOnly cookie (7-day maxAge)
                    ↑
        Token refresh every 50 minutes via setInterval in AuthContext
        getIdToken(forceRefresh: true) → re-POST to /api/auth/session
```

### 2.3 AI Adapter Integration

The AI layer is a **Strategy Pattern** implementation with production-grade reliability features:

```
/api/ai/test POST
    │
    ├─ 1. getCurrentUser()          → Auth guard (Admin SDK verify)
    ├─ 2. Input validation          → Zod-like manual schema
    ├─ 3. checkAllInputsSafety()    → Prompt injection / jailbreak filter
    ├─ 4. createAIAdapter(config)   → Factory picks Gemini or KieAI
    │       ├─ circuitBreaker.guardRequest()
    │       ├─ rateLimiter.acquire()
    │       └─ SDK call with timeout
    ├─ 5. logAuditEntry()          → SHA-256(prompt), userId, status
    └─ 6. Response sanitization    → Never leaks SDK internals
```

**Providers:**
- **Gemini Adapter:** Uses `@google/genai` SDK. Supports text (gemini-2.5-flash), image (gemini-2.5-flash-image), video (veo-3.1-generate-preview). Rate limit: 14 req/60s (1 buffer). Time-out wrapper on all SDK calls.
- **KieAI Adapter:** Custom REST client over Bearer auth. Supports polling for async tasks. Rate limit: 18 req/10s (2 buffer). Model catalog whitelist with `assertValidModel()`.
- Both share: `CircuitBreaker` (CLOSED/OPEN/HALF_OPEN), `RateLimiter` (sliding window), `PromptSafety` filter (regex blocklist for jailbreaks, injections, exfil patterns), `AuditLogger` (SHA-256 hash, never plaintext).

### 2.4 Payment Integration

PayU is integrated as an **HTTP redirect flow**:
1. Client POSTs to `/api/payment/initiate` with payment details.
2. Server generates a HMAC-SHA512 hash and returns form fields + hash to the client.
3. Client-side `PaymentForm` auto-submits an HTML form to PayU's endpoint.
4. PayU redirects to `/api/payment/success` or `/api/payment/failure` (server-to-server callback).
5. `/api/payment/verify` re-computes the hash from PayU's response to confirm authenticity.

### 2.5 Environment Configuration

```
src/lib/firebase/config/environments.ts
├── UAT_CONFIG   → NEXT_PUBLIC_FIREBASE_UAT_* env vars
├── PROD_CONFIG  → NEXT_PUBLIC_FIREBASE_PROD_* env vars
├── IS_PRODUCTION = process.env.NODE_ENV === 'production'
├── USERS_COLLECTION = IS_PRODUCTION ? 'prod_users' : 'uat_users'
├── GEMINI_CONFIG  → apiKey: process.env.GEMINI_API_KEY (server-only)
└── KIEAI_CONFIG   → apiKey: process.env.KIEAI_API_KEY (server-only)
```

---

## 3. Component & Data Flow

### 3.1 Authentication Flow (Sign-in)

```
User fills LoginForm
    │
    ▼
LoginForm (client component)
    │  React Hook Form → loginSchema (Zod: email, password min-1)
    ▼
auth.service.ts → signInWithEmailAndPassword(auth, email, password)
    │  Firebase Client SDK handles the actual auth
    ▼
Firebase Auth returns User object + ID Token
    │
    ▼
AuthContext.onAuthStateChanged fires
    │  setUser(firebaseUser)
    ▼
syncSession(firebaseUser)
    │  firebaseUser.getIdToken(false) → raw JWT string
    │  POST /api/auth/session { token }
    ▼
/api/auth/session route
    │  isValidOrigin() → CSRF check
    │  getAdminAuth().verifyIdToken(token, checkRevoked: true)
    │  cookieStore.set('firebaseAuthToken', token, { httpOnly, secure, sameSite:'lax' })
    ▼
Browser now holds httpOnly cookie with verified ID token
```

### 3.2 Protected Page Access Flow

```
User navigates to /profile
    │
    ▼
proxy.ts
    │  cookies.get('firebaseAuthToken')?.value → truthy?
    │  YES → NextResponse.next()
    │  NO  → redirect('/login?redirect=/profile')
    ▼
(protected)/layout.tsx — Server Component
    │  (optional: getCurrentUser() call here)
    ▼
profile/page.tsx — Server Component
    │  getCurrentUser()
    │    → cookieStore.get('firebaseAuthToken')
    │    → getAdminAuth().verifyIdToken(token, checkRevoked:true)
    │    → returns ServerUser { uid, email, displayName, ... }
    ▼
Page renders with verified user data
```

### 3.3 AI Request Flow

```
/ai-test page (Client Component)
    │  User fills prompt + selects capability + provider
    ▼
POST /api/ai/test
    │
    ├─ getCurrentUser() → Admin SDK verify → uid or 401
    ├─ body.parse() → manual field validation
    ├─ checkAllInputsSafety(prompt, systemInstruction)
    │   → BLOCKED: 400 + logAuditEntry(status:'blocked', blockRule)
    │   → SAFE: continue
    ├─ createAIAdapter(config)
    │   ├─ circuitBreaker.guardRequest() → throws 503 if OPEN
    │   ├─ rateLimiter.acquire()         → waits or throws 429
    │   └─ SDK call + withTimeout()
    ├─ logAuditEntry(status:'success', sha256(prompt), durationMs)
    └─ return sanitized result JSON
```

### 3.4 Data Storage Model (Firestore)

```
Collection: prod_users (or uat_users)
Document ID: Firebase UID
Fields:
  - uid: string
  - displayName: string
  - email: string
  - createdAt: Timestamp
  - (no password stored — Firebase Auth handles credentials)
```

---

## 4. Security Audit vs. Production Standards

> Research sources: [Next.js Auth Docs (Feb 2026)](https://nextjs.org/docs/app/guides/authentication), [OWASP NodeJS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html), [Firebase Security Rules](https://firebase.google.com/docs/rules/basics), [Firebase App Check](https://firebase.google.com/docs/app-check)

---

### 4.1 Authentication & Session Management

#### ✅ PASS — Admin SDK Token Verification

**Standard:** Next.js recommends verifying tokens server-side using a trusted SDK, not trusting cookies blindly.

**Implementation:** `getCurrentUser()` calls `getAdminAuth().verifyIdToken(token, true)` — cryptographic RSA-256 signature verification against Google's public keys. `checkRevoked: true` ensures revoked tokens (from logout on other devices) are rejected immediately.

```typescript
// src/lib/auth/server.ts — correct pattern
const decoded = await getAdminAuth().verifyIdToken(token, /* checkRevoked */ true);
```

**Verdict:** Fully compliant.

---

#### ✅ PASS — httpOnly Cookie with Proper Flags

**Standard (OWASP):** Session cookies must be `httpOnly`, `Secure` (HTTPS only), `SameSite` set to prevent CSRF, and have an appropriate `Path` and expiry.

**Implementation:**
```typescript
// src/lib/auth/server.ts
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};
```

**Verdict:** Fully compliant. `SameSite: 'lax'` is the correct choice for OAuth-style redirect flows.

---

#### ✅ PASS — CSRF Protection on Session Route

**Standard (OWASP):** State-mutating API endpoints must verify the request originates from the legitimate origin.

**Implementation:** `isValidOrigin()` in `/api/auth/session/route.ts` checks `Origin` header first, falls back to `Referer`, compares against `NEXT_PUBLIC_APP_URL` + request's own host + `localhost` in dev.

**Verdict:** Compliant. Covers Vercel preview deployments dynamically via `new URL(request.url).origin`.

---

#### ✅ PASS — Token Refresh Mechanism

**Standard:** Firebase ID tokens expire after 60 minutes. Without refresh, users would be silently logged out.

**Implementation:** `AuthContext.tsx` uses `setInterval` every 50 minutes to call `getIdToken(forceRefresh: true)` and re-POST to `/api/auth/session`. The timer is cleaned up on unmount and on auth state change.

**Verdict:** Fully compliant.

---

#### ✅ PASS — Strong Password Policy (Zod)

**Standard:** NIST SP 800-63B recommends minimum 8 characters and checking against breach databases. Next.js docs show Zod-based validation.

**Implementation:**
```typescript
// src/lib/auth/config.ts
passwordRequirements: {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
}
```
Driven by `AUTH_CONFIG` into Zod `refine()` chains in `auth.ts`. Config changes propagate everywhere automatically.

**Verdict:** Compliant. Consider enabling `requireSpecialChars: true` for higher-security accounts.

---

#### ⚠️ LOW — Cookie `maxAge` Stores Raw ID Token for 7 Days

**Standard:** Firebase ID tokens are valid for only 60 minutes. Storing a 60-minute token with a 7-day cookie expiry means the cookie becomes a stale pointer after the first hour.

**Analysis:** This is harmless in practice because `getCurrentUser()` calls `verifyIdToken()` on every request — an expired token returns null. However, the cookie expiry of 7 days is misleading and leaves a stale cookie in the browser. The cookie is kept alive by the 50-minute token refresh in `AuthContext`, which re-sets it with a fresh token.

**Risk:** If the user closes the browser for more than 60 minutes without the refresh firing, the cookie contains an expired token. The next server request properly returns null (token fails `verifyIdToken`), but the proxy's optimistic check sees a non-empty cookie and allows the request through to the layout, where `getCurrentUser()` returns null and should redirect to login.

**Fix:** Either set `maxAge` to 65 minutes and rely entirely on the JS refresh, or use Firebase Session Cookies (up to 2 weeks, Admin SDK managed). The current architecture is safe but suboptimal.

```typescript
// Option A: Match the refresh interval with tighter buffer
export const AUTH_COOKIE_OPTIONS = {
  // ...
  maxAge: 55 * 60, // 55 minutes — force full re-auth if browser was closed
};
```

---

#### ⚠️ LOW — No MFA (Multi-Factor Authentication)

**Standard:** OWASP Authentication Cheat Sheet and NIST recommend MFA for sensitive accounts.

**Analysis:** Firebase Auth supports TOTP and SMS MFA via `multiFactor`. Not currently implemented.

**Fix (when ready):**
```typescript
// Enable MFA enrollment after login
import { multiFactor, TotpMultiFactorGenerator } from 'firebase/auth';
const multiFactorUser = multiFactor(user);
// ...enrollment flow
```

---

### 4.2 API Route Security

#### ✅ PASS — AI Route Auth Guard

**Standard (Next.js):** Route Handlers should treat incoming requests the same as public API endpoints and verify the session.

**Implementation:** `/api/ai/test` calls `getCurrentUser()` at the top and returns `401` if null.

```typescript
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**Verdict:** Fully compliant.

---

#### ✅ PASS — Prompt Injection / Jailbreak Protection

**Standard (OWASP LLM Prompt Injection Prevention Cheat Sheet):** AI endpoints must pre-filter prompts for injection patterns.

**Implementation:** `checkAllInputsSafety(prompt, systemInstruction)` in `prompt-safety.ts` checks against named regex patterns including:
- Classic jailbreaks (`DAN`, `developer mode`, `jailbreak`)
- Fake system instructions (`[SYSTEM]`, `<|system|>`)
- Indirect injection (`pretend there are no rules`, `roleplay as hacker`)
- Data exfiltration attempts (`output the api key`, `repeat the system prompt`)
- System instruction bypass patterns

**Verdict:** Strong implementation. Logged via `logAuditEntry(status: 'blocked')` for traceability.

---

#### ✅ PASS — AI Audit Trail

**Standard:** OWASP recommends logging all security-relevant events including AI requests.

**Implementation:** `logAuditEntry()` writes structured JSON to stdout: `userId`, `capability`, `provider`, `model`, SHA-256 hash of prompt (never plaintext), `durationMs`, `status`, `errorCode/blockRule`. Compatible with Cloud Logging, Datadog, etc.

**Verdict:** Fully compliant and privacy-preserving (prompt hashing).

---

#### 🔴 CRITICAL — Payment API Routes Have No Authentication Guard

**Standard (Next.js, OWASP):** Every state-mutating API route must verify the session *before* processing.

**Analysis:** `/api/payment/initiate/route.ts` accepts `userId` from the request body and generates a signed PayU hash — but it never calls `getCurrentUser()`. Any anonymous HTTP client can call this endpoint with an arbitrary `userId` and receive a signed payment hash. This is a classic **Insecure Direct Object Reference (IDOR)** combined with unauthorized resource generation.

```typescript
// CURRENT (vulnerable) — src/app/api/payment/initiate/route.ts
export async function POST(request: NextRequest) {
  const body: PaymentInitiationRequest = await request.json();
  // ❌ No auth check — anonymous callers can reach this
  const merchantKey = process.env.NEXT_PUBLIC_PAYU_MERCHANT_KEY;
```

**Fix:**
```typescript
// FIXED pattern
import { getCurrentUser } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // Use user.uid instead of trusting body.userId
  const body = await request.json();
  // ...
}
```

Apply the same fix to `/api/payment/verify/route.ts`.

---

#### 🔴 CRITICAL — `NEXT_PUBLIC_PAYU_MERCHANT_KEY` Exposed to Browser

**Standard:** Any key prefixed `NEXT_PUBLIC_` is bundled into the client JavaScript and visible in the browser's DevTools or source maps.

**Analysis:** `payu-config.ts` reads `process.env.NEXT_PUBLIC_PAYU_MERCHANT_KEY` and stores it in the `PAYU_CONFIG` object. This file is imported in the client-side `PaymentForm.tsx`. The merchant key is now part of the public JavaScript bundle.

While the merchant key alone cannot make unauthorized charges (the salt/hash is required), exposing it:
1. Allows fraudsters to craft fake payment requests targeting your merchant account.
2. Violates PayU's Terms of Service, which require the key to remain confidential.

```typescript
// CURRENT (vulnerable) — src/lib/payment/payu-config.ts
merchantKey: process.env.NEXT_PUBLIC_PAYU_MERCHANT_KEY || '',
```

**Fix:** Rename to `PAYU_MERCHANT_KEY` (no `NEXT_PUBLIC_`) and only access it in server-side files:

```typescript
// In /api/payment/initiate/route.ts (server-only)
const merchantKey = process.env.PAYU_MERCHANT_KEY;

// Remove from payu-config.ts entirely — that file should not hold the key
// The PaymentForm only submits the hash + fields returned by the API
```

---

#### ⚠️ MEDIUM — Payment Callbacks Trust PayU Parameters Without Re-verification

**Standard (OWASP Third Party Payment Gateway Integration):** Payment success/failure callbacks must re-verify the hash before updating any order status.

**Analysis:** `/api/payment/success` and `/api/payment/failure` receive POST data from PayU. The `verify/route.ts` performs hash re-verification, but the `success` route currently renders a response before that verification completes on the client side (`PaymentSuccessContent.tsx` reads URL params directly).

**Fix:** The success page should use a loading state, call `/api/payment/verify`, and only display success UI after a `200` response from the verification endpoint.

---

### 4.3 Environment Variables & Secret Management

#### ✅ PASS — AI API Keys are Server-Only

After the previous security hardening session, both AI provider keys use no `NEXT_PUBLIC_` prefix:
```
GEMINI_API_KEY=...   (server-only)
KIEAI_API_KEY=...    (server-only)
```

Accessed exclusively in `environments.ts` and passed to the adapter constructors — never in client components.

**Verdict:** Fully compliant with OWASP Secrets Management guidelines.

---

#### ✅ PASS — Firebase Service Account Key Handling

**Standard:** Service account JSON must never be committed to source control and must be injected at runtime.

**Implementation:** `admin.ts` reads `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string env var) or falls back to `GOOGLE_APPLICATION_CREDENTIALS` / GCP auto-discovery. No credentials are hardcoded.

**Verdict:** Compliant. Ensure `.env.local` is in `.gitignore` (standard Next.js behavior).

---

#### ⚠️ MEDIUM — Firebase Client Config Uses `NEXT_PUBLIC_` (Expected, but Acknowledge Risk)

**Analysis:** The Firebase Web SDK client config (`apiKey`, `projectId`, etc.) is intentionally public — these are not secret. Firebase Security Rules and App Check are the actual protection layer. However, developers sometimes mistake the Firebase Web API key for a privileged server key.

**Clarification:** The Firebase Web `apiKey` is a project identifier for the Firebase Web SDK, not a privileged credential. Exposure is expected and by design. The real risk is if Firestore Security Rules are too permissive (see Section 4.4).

---

### 4.4 Firebase Security Rules

#### 🔴 CRITICAL — No Firestore Security Rules Defined in Codebase

**Standard (Firebase Docs):** "Firebase Security Rules are the only safeguard blocking access for malicious users." The Firebase console shows Locked mode by default, but rules must be explicitly managed and version-controlled.

**Analysis:** There are no `firestore.rules` or `storage.rules` files in the workspace. This means:
1. Rules exist only in the Firebase console and are not under version control.
2. There is no way to audit what rules are active from code review.
3. CI/CD cannot deploy rule changes automatically.

**Fix:** Create `firestore.rules` at the project root:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own document
    match /prod_users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /uat_users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Deny all other documents by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy with:
```bash
firebase deploy --only firestore:rules
```

---

#### ⚠️ HIGH — Firebase App Check Not Implemented

**Standard (Firebase App Check Docs):** App Check prevents unauthorized apps and bots from directly accessing Firestore and other Firebase services using the Web SDK. reCAPTCHA Enterprise is the recommended provider for web apps.

**Analysis:** The Firebase Web SDK (`firebase.ts`) initialises without App Check. Any attacker with access to the Firebase config (which is public) can make raw Firestore SDK calls from their own code, bypassing your application entirely — circumventing all route guards and security rules.

**Fix:** Add App Check during Firebase app initialisation:

```typescript
// src/lib/firebase/firebase.ts
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const app = initializeApp(firebaseConfig);

// Enable App Check (web uses reCAPTCHA Enterprise)
if (typeof window !== 'undefined') {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!
    ),
    isTokenAutoRefreshEnabled: true,
  });
}
```

Add `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` to `.env.local` and enforce App Check in the Firebase console.

---

### 4.5 Content Security & HTTP Headers

#### ⚠️ HIGH — No Content Security Policy (CSP) Headers

**Standard (OWASP, MDN):** CSP headers are the primary defence against XSS. They restrict which scripts, styles, and resources the browser can load.

**Analysis:** The `next.config.ts` does not define security headers. Next.js 16 supports CSP via `headers()` in the config.

**Fix:** Add to `next.config.ts`:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com",
              "frame-src https://www.google.com",
              "font-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://secure.payu.in https://test.payu.in",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};
```

---

#### ⚠️ MEDIUM — `X-Powered-By: Next.js` Header Not Disabled

**Standard (OWASP):** Technology disclosure headers reduce the attack surface by preventing targeted exploitation.

**Fix:**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ... rest of config
};
```

---

### 4.6 Input Validation & XSS

#### ✅ PASS — Zod Schema Validation on All Forms

All forms use React Hook Form with `@hookform/resolvers/zod`. Schemas are defined in `src/lib/validations/auth.ts` and driven by `AUTH_CONFIG`. Validation runs both client-side (UX) and server-side (security).

**Verdict:** Fully compliant with Next.js auth guide recommendations.

---

#### ✅ PASS — No `dangerouslySetInnerHTML` Usage

A full scan of the codebase found no `dangerouslySetInnerHTML` calls. React's built-in JSX escaping prevents reflected XSS.

**Verdict:** XSS risk from direct DOM manipulation is minimal.

---

#### ⚠️ MEDIUM — Open Redirect in Proxy

**Standard:** The `redirect` URL parameter must be validated server-side to prevent open redirect attacks.

**Analysis:** In `proxy.ts`, when an authenticated user visits an auth route with a `?redirect=` param, the code does:
```typescript
const redirectParam = request.nextUrl.searchParams.get('redirect');
const redirectUrl = new URL(
  redirectParam && !redirectParam.startsWith('/login') ? redirectParam : DEFAULT_REDIRECT,
  request.url
);
```

The guard `!redirectParam.startsWith('/login')` is insufficient. An attacker could craft `/login?redirect=https://evil.com` or `/login?redirect=//evil.com`. The `new URL(attackerValue, request.url)` call would resolve to an external URL.

**Fix:**
```typescript
// Only allow relative redirects to paths within the app
function sanitizeRedirect(redirect: string | null): string {
  if (!redirect) return DEFAULT_REDIRECT;
  // Must start with '/' and not be a protocol-relative URL
  if (redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return DEFAULT_REDIRECT;
}
```

---

### 4.7 Rate Limiting & Brute Force Protection

#### ✅ PASS — AI Adapter Rate Limiting

Gemini (14 req/60s) and KieAI (18 req/10s) both have in-process sliding-window rate limiters with `waitForSlot` and `maxWaitMs` backoff. Provider-side 429s are handled explicitly.

---

#### ⚠️ HIGH — No Rate Limiting on Auth Endpoints

**Standard (OWASP):** Login endpoints are primary brute force targets. They must be rate-limited.

**Analysis:** `/api/auth/session` (POST) has no rate limiting. The Firebase Auth SDK on the client handles some rate limiting, but a direct API request bypasses the SDK. Additionally, forgot-password form submissions (`ForgotPasswordForm.tsx`) call `sendPasswordResetEmail()` without any server-side rate limiting — this can be abused to spam users.

**Fix:** Use an edge-capable rate limiter. For Next.js, `@upstash/ratelimit` with Redis (or Vercel KV) is the standard:

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const authRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 attempts per minute
  analytics: true,
});

// In /api/auth/session POST:
const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
const { success } = await authRateLimit.limit(ip);
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
```

---

### 4.8 Dependency & Supply Chain Security

#### ⚠️ MEDIUM — No Automated Dependency Vulnerability Scanning

**Standard (OWASP):** `npm audit` and automated tools like Dependabot or Snyk should run in CI to catch known CVEs in dependencies.

**Current state:** `package.json` scripts do not include an audit step.

**Fix:**
```json
// package.json
"scripts": {
  "audit:ci": "npm audit --audit-level=moderate",
  "dev": "next dev --turbopack",
  // ...
}
```

Set up GitHub Dependabot by adding `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
```

---

#### ✅ PASS — No `eval()` or Dangerous Functions

No usage of `eval()`, `Function()`, `child_process.exec` with user input, or `vm.runInThisContext` was found in the codebase.

---

#### ⚠️ LOW — Missing `npm audit` Report / `lockfile` Integrity

`package-lock.json` is not visible in the workspace listing. Ensure it is committed and `npm ci` is used in CI (not `npm install`) to guarantee deterministic, integrity-checked installs.

---

### 4.9 React Taint API (Next.js 16 Recommended)

#### ⚠️ LOW — Sensitive Server Values Not Tagged with `experimental_taintUniqueValue`

**Standard (Next.js 16 Auth Docs):** For sensitive data that should never reach the client (tokens, secrets), React 19's `experimental_taintUniqueValue` API can provide an extra safety net.

**Analysis:** This is an optional defence-in-depth measure. The codebase already correctly avoids passing tokens to client components, making this a low-priority enhancement.

**Fix (optional, defence-in-depth):**
```typescript
// next.config.ts
const nextConfig = {
  experimental: { taint: true },
};

// In server.ts when token is read:
import { experimental_taintUniqueValue } from 'react';
experimental_taintUniqueValue(
  'Firebase ID token must not be sent to the client',
  request, // object to associate the taint with
  token
);
```

---

## 5. Code Rating & Final Verdict

### 5.1 Scoring Matrix

| Dimension | Score | Notes |
|---|---|---|
| **Security** | 7.5 / 10 | Auth layer is excellent. Payment layer needs auth guards, key rotation, and CSP. Firebase App Check missing. |
| **Maintainability** | 9.0 / 10 | Clean architecture, TypeScript strict, env-switched config, excellent AI adapter pattern, Zod-driven validation |
| **Performance** | 8.0 / 10 | React `cache()` on `getCurrentUser()`, Turbopack dev, rate limiting, circuit breaker. No CSP/headers caching configuration yet. |
| **Reliability** | 8.5 / 10 | Circuit breaker + rate limiter on AI, token refresh, error sanitization. Payment callbacks could be tighter. |

**Overall:** **8.2 / 10**

---

### 5.2 Severity Summary

| Severity | Count | Items |
|---|---|---|
| 🔴 Critical | 3 | Payment API has no auth guard, `NEXT_PUBLIC_PAYU_MERCHANT_KEY` exposed, No Firestore Security Rules in version control |
| 🟠 High | 3 | Firebase App Check not enabled, No CSP headers, No rate limiting on auth endpoints |
| 🟡 Medium | 4 | Payment callback trust issue, Open redirect in proxy, `X-Powered-By` not disabled, No dependency scanning |
| 🟢 Low | 4 | Cookie `maxAge` vs token expiry mismatch, No MFA, React Taint API not used, `package-lock.json` integrity |

---

### 5.3 Production Readiness Checklist

#### 🔴 Must Fix Before Production

- [ ] **Add `getCurrentUser()` auth guard to `/api/payment/initiate` and `/api/payment/verify`**  
  Prevents anonymous callers from generating signed payment hashes.

- [ ] **Rename `NEXT_PUBLIC_PAYU_MERCHANT_KEY` → `PAYU_MERCHANT_KEY`**  
  Remove from `payu-config.ts`. Access only in server-side API routes.

- [ ] **Create and deploy `firestore.rules`**  
  Restricts user documents to owner-only access. Version-control rules with `firebase deploy --only firestore:rules`.

#### 🟠 High Priority (Ship Soon)

- [ ] **Enable Firebase App Check (reCAPTCHA Enterprise for web)**  
  Prevents direct Firebase SDK abuse. Requires `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` env var.

- [ ] **Add security headers in `next.config.ts`**  
  CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

- [ ] **Add rate limiting to `/api/auth/session` and forgot-password flow**  
  Use `@upstash/ratelimit` or similar edge-compatible solution. 10 req/min per IP is a sensible default.

- [ ] **Disable `poweredByHeader` in `next.config.ts`**  
  `poweredByHeader: false` — prevent technology fingerprinting.

#### 🟡 Medium Priority (Next Sprint)

- [ ] **Fix open redirect in `proxy.ts`**  
  Validate `redirect` param — only allow paths starting with `/` but not `//`.

- [ ] **Add payment callback server-side verification before rendering success UI**  
  `PaymentSuccessContent.tsx` should show a loading spinner, call `/api/payment/verify`, then render.

- [ ] **Set up Dependabot or `npm audit` in CI pipeline**  
  Weekly dependency scans with `npm audit --audit-level=moderate`.

#### 🟢 Low Priority / Nice-to-Have

- [ ] **Enable `requireSpecialChars: true` in `auth/config.ts`** for higher security tier.
- [ ] **Implement Firebase MFA** (TOTP via `multiFactor` API) for privileged accounts.
- [ ] **Evaluate Firebase Session Cookies** (Admin SDK `createSessionCookie`) for true server-managed sessions instead of raw ID token cookies.
- [ ] **Add `experimental_taintUniqueValue`** on server-read tokens for defence-in-depth.
- [ ] **Add `storage.rules`** file for Cloud Storage if the feature is used.
- [ ] **Enable React Strict Mode** in `next.config.ts` (`reactStrictMode: true`) for detecting side-effect bugs.

---

### 5.4 Strengths (What the Codebase Does Exceptionally Well)

The following areas represent **above-average security implementations** that many production apps lack:

1. **Firebase Admin SDK `verifyIdToken(token, checkRevoked: true)`** — most Firebase Next.js tutorials omit the revocation check entirely. This codebase includes it.

2. **AI Prompt Injection Defence** — a comprehensive, regex-based pre-filter with named rules, audit logging of blocked attempts, and separate handling for system instructions. This exceeds what most production AI apps implement.

3. **AI Layer Resilience** — Circuit breaker (CLOSED/OPEN/HALF_OPEN), sliding-window rate limiter, SDK-level timeouts, and provider-side 429 handling are enterprise-grade patterns rarely seen in indie projects.

4. **Dual-Environment Firestore Collections** — `USERS_COLLECTION` constant that env-switches between `uat_users` and `prod_users` prevents UAT data from polluting production and vice versa.

5. **90-minute `setInterval` token refresh** — solves a common gotcha in Firebase + Next.js where the 60-minute token expiry silently logs out active users mid-session.

6. **Error message parity** — `auth/weak-password` error message exactly matches the actual configured policy (8 chars + uppercase + number), preventing user confusion.

7. **Zero TypeScript errors** — `npx tsc --noEmit` passes clean across all sessions of development.

---

*End of Audit Report — Generated February 21, 2026*

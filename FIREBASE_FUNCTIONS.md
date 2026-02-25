# Firebase Functions — LinkedIn Autoposter

## What Are These Functions?

Firebase Functions are **serverless background jobs** that run on Google's cloud infrastructure on a schedule — completely outside your Next.js app. They are the automation engine of the autoposter: they run without any user action, every day, and drive the entire post lifecycle from draft → review → LinkedIn.

---

## The 3 Functions

### 1. `generateDrafts` — The Content Creator
**What it does:** Runs every night and creates AI draft posts for the next posting day.

**Exact flow:**
1. Loads every user's autoposter profile from Firestore
2. For each user, checks: *"Is tomorrow a posting day in their schedule?"* (e.g. Tuesday at 10 AM)
3. Skips if they already have a post scheduled for tomorrow
4. Picks the next topic — first checks the **Idea Bank**, then falls back to the active **Series** topic queue
5. Calls the AI (Gemini / Kie.AI) to generate the full post content using the user's persona and preferred model
6. Saves the post to Firestore with status `pending_review`

**Result:** Every morning when the user opens the app, a fresh draft is waiting in the "Needs Review" tab.

---

### 2. `cutoffReview` — The Auto-Skipper
**What it does:** Runs in the early morning to clean up posts that were never reviewed.

**Exact flow:**
1. Queries all posts where `status = pending_review` AND `reviewDeadline <= now`
2. For each expired post: sets status to `skipped`
3. Advances the series topic index (so the *next* auto-run picks the *next* topic, not a stale one)

**Result:** If the user never reviewed a draft before the deadline, it gets automatically skipped and the series moves forward — the autoposter never gets stuck.

---

### 3. `publishPosts` — The LinkedIn Publisher
**What it does:** Publishes approved posts to LinkedIn at their scheduled time.

**Exact flow:**
1. Queries all posts where `status = approved` AND `scheduledFor <= now`
2. For each due post:
   - Loads the user's LinkedIn OAuth token from Firestore
   - Refreshes the token if it has expired
   - Uploads any media to LinkedIn (images pre-captured at approval time for HTML carousel posts)
   - Calls the LinkedIn REST API to create the post
   - Marks the post as `published` with the LinkedIn post ID
   - Advances the series topic index
3. On any error: marks post as `failed` with the error reason

**Result:** Approved posts get published to LinkedIn automatically at the exact time scheduled, without the user needing to be online.

---

## How They Connect to the Next.js App

The functions themselves contain **no AI or LinkedIn logic**. They are thin HTTP callers that call your Next.js API routes, which contain all the real logic:

```
Firebase Scheduler (every 5 min)
         │
         ▼
  functions/src/index.ts
  (calls HTTP POST with CRON_SECRET header)
         │
         ├──▶  POST /api/autoposter/generate-all   ──▶  AI draft generation
         ├──▶  POST /api/autoposter/cutoff-all     ──▶  Skip expired reviews
         └──▶  POST /api/autoposter/publish-all    ──▶  Publish to LinkedIn
```

This design means:
- All Firebase Admin, AI, and LinkedIn logic lives in the Next.js codebase (easier to develop and test)
- The functions are just a reliable cron trigger (5 lines each)
- You can manually test any endpoint from Settings (the "Test Draft Generation" button calls `/api/autoposter/trigger` directly)

---

## Current Schedules (Testing Mode)

All 3 functions currently fire **every 5 minutes**. This lets you see them working quickly.

| Function | Testing | Production (IST) |
|---|---|---|
| `generateDrafts` | every 5 min | 9:00 PM — Mon, Tue, Wed |
| `cutoffReview` | every 5 min | 3:00 AM — Tue, Wed, Thu |
| `publishPosts` | every 5 min | Every 30 min, 8–11 AM — Tue, Wed, Thu |

### Switching to Production Schedules

Edit `functions/src/index.ts` for each function — comment out the testing line and uncomment production:

```typescript
// BEFORE (testing)
schedule: 'every 5 minutes',

// AFTER (production)
schedule: '0 21 * * 1,2,3',  // generateDrafts — 9 PM IST Mon/Tue/Wed
schedule: '0 3 * * 2,3,4',   // cutoffReview   — 3 AM IST Tue/Wed/Thu
schedule: '0,30 8-11 * * 2,3,4', // publishPosts — every 30 min 8–11 AM
```

Then redeploy:
```bash
cd functions && npm run build
cd .. && firebase deploy --only functions
```

---

## The Full Automated Flow (Day in the Life)

```
Monday 9 PM IST
  │
  ├── generateDrafts fires
  │   └── Checks each user's schedule: "Is Tuesday enabled?"
  │       └── Yes → picks next series topic → AI generates post
  │           └── Saves as pending_review, scheduledFor = Tuesday 10 AM
  │
Monday 11 PM (or whenever review deadline is)
  │
  ├── cutoffReview fires
  │   └── Any pending_review posts past their deadline → skipped
  │
Tuesday 10 AM IST
  │
  └── publishPosts fires
      └── Finds approved posts with scheduledFor ≤ now
          └── Uploads images → calls LinkedIn API → marks published ✅
```

---

## Environment Variables Required

### In your Next.js app (`.env.local` + Vercel Settings):
```
CRON_SECRET=VJL0uoOZpc98Pkid5hXGNYCayBjKRre2A3f4vHsx
```
This secret protects the 3 admin endpoints so only Firebase Functions can call them.

### In Firebase Functions (`functions/.env`):
```
APP_URL=https://autopost-linkedin.vercel.app
CRON_SECRET=VJL0uoOZpc98Pkid5hXGNYCayBjKRre2A3f4vHsx
```

---

## File Structure

```
functions/
├── .env                  ← APP_URL + CRON_SECRET (not committed to git)
├── .env.example          ← Template for the above
├── package.json          ← firebase-functions v6, Node.js 22
├── tsconfig.json
└── src/
    └── index.ts          ← All 3 scheduled functions

src/app/api/autoposter/
├── generate-all/route.ts ← Draft generation logic (called by generateDrafts)
├── cutoff-all/route.ts   ← Review cutoff logic (called by cutoffReview)
├── publish-all/route.ts  ← LinkedIn publish logic (called by publishPosts)
└── trigger/route.ts      ← Manual test trigger (called from Settings UI)
```

---

## Monitoring & Debugging

**View logs:**
```bash
firebase functions:log
# or filter by function:
firebase functions:log --only generateDrafts
```

**Firebase Console:**  
https://console.firebase.google.com/project/linkedin-autoposter-55f25/functions

Each function row shows:
- **Invocations** — how many times it fired
- **Errors** — any failures
- **Latency** — how long it took (AI generation can take 30–90 seconds)

---

## Adding a New Function

1. Add a new `onSchedule` export in `functions/src/index.ts`
2. Add the corresponding Next.js API route in `src/app/api/autoposter/`
3. Protect it with the `x-cron-secret` header check (copy from any existing route)
4. Build and deploy: `cd functions && npm run build && cd .. && firebase deploy --only functions`

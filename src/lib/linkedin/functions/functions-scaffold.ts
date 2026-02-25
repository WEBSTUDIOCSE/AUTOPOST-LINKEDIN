/**
 * Firebase Functions — LinkedIn Autoposter
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  This file is a SCAFFOLD / BLUEPRINT.                       │
 * │                                                             │
 * │  Firebase Functions run OUTSIDE of the Next.js app in a     │
 * │  separate Node.js runtime deployed to Cloud Functions.      │
 * │                                                             │
 * │  To use this:                                               │
 * │  1. Run: firebase init functions (in project root)          │
 * │  2. Copy this logic into the generated functions/src/       │
 * │  3. Deploy: firebase deploy --only functions                │
 * │                                                             │
 * │  We keep this scaffold inside the Next.js repo so that the  │
 * │  architecture is visible and version-controlled alongside   │
 * │  the rest of the codebase.                                  │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Functions overview:
 *
 * SCHEDULED:
 *   1. generateDrafts  — runs every 5 minutes (for testing; production: 9 PM IST Mon-Wed)
 *   2. cutoffReview    — runs every 5 minutes (for testing; production: 3 AM IST Tue-Thu)
 *   3. publishPosts    — runs every 5 minutes (for testing; production: 30-min slots 8-11 AM)
 *
 * HTTP (called from the Next.js app):
 *   4. onPostApproved  — Firestore trigger when status → approved
 *
 * The pseudo-code below shows the exact logic for each function.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES (mirror the Next.js types — duplicated here for independence)
// ═══════════════════════════════════════════════════════════════════════════════

/*
  In the real functions project, you'd either:
  a) Share types via a `shared/` package using npm workspaces, or
  b) Copy the types file. Option (a) is recommended for production.
*/

// ═══════════════════════════════════════════════════════════════════════════════
// 1. GENERATE DRAFTS — every 5 minutes (testing) / 9 PM IST Mon/Tue/Wed (production)
// ═══════════════════════════════════════════════════════════════════════════════

/*
  TESTING schedule:  "every-5-min" (cron: * /5 * * * * — no space)
  PRODUCTION schedule: "0 21 * * 1,2,3" (9:00 PM every Mon, Tue, Wed IST)

  Logic:
  ┌───────────────────────────────────────────────────────┐
  │ For each user with an active autoposter profile:      │
  │                                                       │
  │ 1. Check if TOMORROW is a posting day in their        │
  │    schedule. If not → skip.                           │
  │                                                       │
  │ 2. Determine the topic:                               │
  │    a. Check ideas bank for an unused idea:            │
  │       - First: idea attached to the active series     │
  │       - Then: any standalone unused idea              │
  │    b. If no idea → use the next topic from the        │
  │       active series queue (topicQueue[currentIndex])  │
  │    c. If no series or series complete → skip, notify  │
  │                                                       │
  │ 3. Get continuity context:                            │
  │    - Fetch the last published post in this series     │
  │    - Extract its summary (previousPostSummary)        │
  │                                                       │
  │ 4. Call AI to generate the draft:                     │
  │    - Input: topic, notes, seriesTitle, previous       │
  │      summary, persona                                 │
  │    - Output: { content, summary }                     │
  │                                                       │
  │ 5. Create a Firestore post document:                  │
  │    - status: "pending_review"                         │
  │    - scheduledFor: tomorrow at the posting time       │
  │    - reviewDeadline: tonight at 3 AM                  │
  │                                                       │
  │ 6. Mark the idea as used (if one was consumed)        │
  │                                                       │
  │ 7. Send FCM notification:                             │
  │    "📝 Your [topic] post for tomorrow is ready.       │
  │     Review by 3 AM"                                   │
  └───────────────────────────────────────────────────────┘

  Pseudo-code:

  export const generateDrafts = onSchedule(
    { schedule: "every 5 minutes", timeZone: "Asia/Kolkata" },  // TESTING (real cron: star-slash-5 * * * *)
    // PRODUCTION: { schedule: "0 21 * * 1,2,3", timeZone: "Asia/Kolkata" },
    async () => {
      const profiles = await getAllActiveProfiles();

      for (const profile of profiles) {
        const tomorrow = getNextDay();
        const dayKey = getDayName(tomorrow).toLowerCase(); // "tuesday"

        if (!profile.postingSchedule[dayKey]?.enabled) continue;

        // Determine topic
        const series = await getActiveSeries(profile.userId);
        const idea = await getNextUnusedIdea(profile.userId, series?.id);

        let topic: string;
        let notes: string | undefined;
        let seriesId: string | undefined;
        let topicIndex: number | undefined;

        if (idea) {
          topic = idea.text;
          notes = idea.seriesId ? undefined : undefined;
          seriesId = idea.seriesId ?? series?.id;
          await markIdeaUsed(idea.id);
        } else if (series && series.currentIndex < series.topicQueue.length) {
          const t = series.topicQueue[series.currentIndex];
          topic = t.title;
          notes = t.notes;
          seriesId = series.id;
          topicIndex = series.currentIndex;
        } else {
          // No topic available — skip & notify
          await sendFCM(profile.fcmToken, {
            type: 'post_skipped',
            title: 'No topics available',
            body: 'Add ideas or topics to your series to keep posting.',
          });
          continue;
        }

        // Continuity
        const lastPost = seriesId
          ? await getLastPublishedInSeries(profile.userId, seriesId)
          : null;

        // Generate draft — use profile's preferred AI model
        const draft = await generatePostDraft({
          topic,
          notes,
          seriesTitle: series?.title,
          previousPostSummary: lastPost?.previousPostSummary,
          persona: profile.persona,
          publishDay: getDayName(tomorrow),
          // AI model preferences from user profile
          provider: profile.preferredProvider,
          textModel: profile.preferredTextModel,
          mediaType: profile.preferredMediaType ?? 'text',
        });

        // Calculate times
        const postTime = profile.postingSchedule[dayKey].postTime; // "10:00"
        const [h, m] = postTime.split(':').map(Number);
        const scheduledFor = new Date(tomorrow);
        scheduledFor.setHours(h, m, 0, 0);

        const reviewDeadline = new Date();
        reviewDeadline.setHours(profile.reviewDeadlineHour, 0, 0, 0);
        if (reviewDeadline < new Date()) {
          reviewDeadline.setDate(reviewDeadline.getDate() + 1);
        }

        // Save post
        await createPost({
          userId: profile.userId,
          topic,
          content: draft.content,
          scheduledFor,
          reviewDeadline,
          seriesId,
          topicIndex,
          previousPostSummary: draft.summary,
        });

        // Notify
        await sendFCM(profile.fcmToken, {
          type: 'draft_ready',
          title: '📝 Post draft ready',
          body: `Your "${topic}" post for ${getDayName(tomorrow)} is ready. Review by ${profile.reviewDeadlineHour}:00.`,
          clickAction: '/dashboard',
        });
      }
    }
  );
*/

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CUTOFF REVIEW — every 5 minutes (testing) / 3 AM IST Tue/Wed/Thu (production)
// ═══════════════════════════════════════════════════════════════════════════════

/*
  TESTING schedule:  "every-5-min" (cron: * /5 * * * * — no space)
  PRODUCTION schedule: "0 3 * * 2,3,4" — 3:00 AM every Tue, Wed, Thu IST

  Logic:
  ┌───────────────────────────────────────────────────────┐
  │ Query all posts where:                                │
  │   status == "pending_review"                          │
  │   reviewDeadline <= now                               │
  │                                                       │
  │ For each:                                             │
  │   1. Set status → "skipped"                           │
  │   2. If post belongs to a series, advance the index   │
  │   3. Send FCM: "⏭ Post skipped — no review"          │
  └───────────────────────────────────────────────────────┘

  export const cutoffReview = onSchedule(
    { schedule: "every 5 minutes", timeZone: "Asia/Kolkata" },  // TESTING (real cron: star-slash-5 * * * *)
    // PRODUCTION: { schedule: "0 3 * * 2,3,4", timeZone: "Asia/Kolkata" },
    async () => {
      const expiredPosts = await getPostsPastDeadline(); // status=pending_review, reviewDeadline<=now
      for (const post of expiredPosts) {
        await updatePostStatus(post.id, 'skipped');
        if (post.seriesId) {
          await advanceSeriesIndex(post.seriesId);
        }
        const profile = await getProfile(post.userId);
        await sendFCM(profile?.fcmToken, {
          type: 'post_skipped',
          title: '⏭ Post skipped',
          body: `"${post.topic}" was not reviewed in time.`,
        });
      }
    }
  );
*/

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PUBLISH POSTS — every 5 minutes (testing) / Morning posting times (production)
// ═══════════════════════════════════════════════════════════════════════════════

/*
  TESTING schedule:  "every-5-min" (cron: * /5 * * * * — no space)
  PRODUCTION schedule: "0,30 8-11 * * 2,3,4" — every 30 min from 8–11 AM IST
  (Checks for posts whose scheduledFor <= now and status == "approved")

  A more precise approach is to use Cloud Tasks — create a task at the
  exact scheduledFor time when the post is approved. This avoids polling.
  But for V1, polling every 30 min is simple and sufficient.

  Logic:
  ┌───────────────────────────────────────────────────────┐
  │ Query all posts where:                                │
  │   status == "approved"                                │
  │   scheduledFor <= now                                 │
  │                                                       │
  │ For each:                                             │
  │   1. Fetch the user's LinkedIn access token           │
  │   2. If token expired → try refresh                   │
  │   3. Call LinkedIn API → createPost()                 │
  │   4. If success:                                      │
  │      - Set status → "published", save linkedinPostId  │
  │      - Advance series index                           │
  │      - Send FCM: "✅ Posted!"                         │
  │   5. If failure:                                      │
  │      - Set status → "failed", save failureReason      │
  │      - Send FCM: "❌ Post failed — tap to retry"      │
  └───────────────────────────────────────────────────────┘

  export const publishPosts = onSchedule(
    { schedule: "every 5 minutes", timeZone: "Asia/Kolkata" },  // TESTING (real cron: star-slash-5 * * * *)
    // PRODUCTION: { schedule: "0,30 8-11 * * 2,3,4", timeZone: "Asia/Kolkata" },
    async () => {
      const duePosts = await getApprovedPostsDue(); // status=approved, scheduledFor<=now
      for (const post of duePosts) {
        const profile = await getProfile(post.userId);
        if (!profile?.linkedinConnected || !profile.linkedinAccessToken) {
          await markPostFailed(post.id, 'LinkedIn not connected');
          continue;
        }

        try {
          // Refresh token if needed
          let accessToken = profile.linkedinAccessToken;
          if (profile.linkedinTokenExpiry && profile.linkedinTokenExpiry < new Date()) {
            if (profile.linkedinRefreshToken) {
              const tokens = await refreshAccessToken(profile.linkedinRefreshToken);
              accessToken = tokens.accessToken;
              await updateLinkedInTokens(profile.userId, tokens);
            } else {
              await markPostFailed(post.id, 'LinkedIn token expired — reconnect required');
              await sendFCM(profile.fcmToken, {
                type: 'linkedin_token_expiring',
                title: '🔑 LinkedIn reconnect needed',
                body: 'Your LinkedIn token has expired. Reconnect in settings.',
              });
              continue;
            }
          }

          // Publish
          const content = post.editedContent ?? post.content;

          // If the post has pre-captured images (HTML posts capture at
          // approval time), upload them to LinkedIn first.
          let mediaAssetUrns: string[] | undefined;
          let mediaAssetUrn: string | undefined;

          if (post.mediaType === 'html' && post.imageUrls?.length) {
            // HTML carousel / single-image — images were captured client-side
            // at approval time and stored in Firebase Storage.
            const urns: string[] = [];
            for (const storageUrl of post.imageUrls) {
              const buffer = await downloadMediaAsBuffer(storageUrl);
              const { imageUrn } = await uploadImageToLinkedIn(
                accessToken,
                profile.linkedinMemberUrn!,
                buffer,
              );
              urns.push(imageUrn);
            }
            mediaAssetUrns = urns.length > 1 ? urns : undefined;
            mediaAssetUrn = urns.length === 1 ? urns[0] : undefined;
          } else if (post.mediaUrl) {
            // Non-HTML media (image / video) stored in Firebase Storage
            const buffer = await downloadMediaAsBuffer(post.mediaUrl);
            if (post.mediaType === 'image') {
              const { imageUrn } = await uploadImageToLinkedIn(
                accessToken,
                profile.linkedinMemberUrn!,
                buffer,
              );
              mediaAssetUrn = imageUrn;
            } else if (post.mediaType === 'video') {
              const { videoUrn } = await uploadVideoToLinkedIn(
                accessToken,
                profile.linkedinMemberUrn!,
                buffer,
              );
              mediaAssetUrn = videoUrn;
            }
          }

          const linkedinPostId = await createLinkedInPost({
            accessToken,
            authorUrn: profile.linkedinMemberUrn!,
            text: content,
            mediaType: post.mediaType,
            mediaAssetUrn: mediaAssetUrns ? mediaAssetUrns[0] : mediaAssetUrn,
            mediaAssetUrns,
          });

          await markPostPublished(post.id, linkedinPostId);

          if (post.seriesId) {
            await advanceSeriesIndex(post.seriesId);
          }

          await sendFCM(profile.fcmToken, {
            type: 'post_published',
            title: '✅ Posted on LinkedIn!',
            body: `"${post.topic}" is now live.`,
          });

        } catch (error) {
          await markPostFailed(post.id, String(error));
          await sendFCM(profile.fcmToken, {
            type: 'post_failed',
            title: '❌ Post failed',
            body: `"${post.topic}" could not be published. Tap to retry.`,
            postId: post.id,
          });
        }
      }
    }
  );
*/

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

/*
  When setting up the real Firebase Functions project:

  functions/
  ├── package.json
  ├── tsconfig.json
  └── src/
      ├── index.ts          ← exports all 3 scheduled functions
      ├── generate-drafts.ts
      ├── cutoff-review.ts
      ├── publish-posts.ts
      ├── utils/
      │   ├── firestore.ts  ← Admin SDK Firestore helpers
      │   ├── fcm.ts        ← sendFCM helper using admin.messaging()
      │   └── linkedin.ts   ← LinkedIn API calls (same as linkedin-oauth.ts)
      └── shared/
          └── types.ts      ← copy of linkedin/types.ts

  Deploy commands:
    firebase deploy --only functions
    firebase functions:log  (view logs)
*/

export {};

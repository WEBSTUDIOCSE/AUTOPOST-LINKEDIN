/**
 * Post Service — CRUD + lifecycle management for LinkedIn posts
 *
 * Manages the full lifecycle: pending_review → approved → published.
 * Also handles skip, reject, fail, and retry flows.
 */

import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { firebaseHandler, firebaseVoidHandler } from '@/lib/firebase/handler';
import { POSTS_COLLECTION } from '../collections';
import type { Post, PostStatus, PostMediaType } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toPost(id: string, data: FirebaseFirestore.DocumentData): Post {
  return {
    ...data,
    id,
    scheduledFor: (data.scheduledFor as Timestamp)?.toDate?.() ?? new Date(),
    reviewDeadline: (data.reviewDeadline as Timestamp)?.toDate?.() ?? new Date(),
    publishedAt: (data.publishedAt as Timestamp)?.toDate?.() ?? undefined,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
  } as Post;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const PostService = {
  /**
   * Create a new post (called by the draft-generation function).
   * Supports text-only, image, and video posts.
   * Returns the new post ID.
   */
  create(data: {
    userId: string;
    topic: string;
    content: string;
    scheduledFor: Date;
    reviewDeadline: Date;
    seriesId?: string;
    topicIndex?: number;
    previousPostSummary?: string;
    inputPrompt?: string;
    mediaType?: PostMediaType;
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaPrompt?: string;
    linkedinMediaAsset?: string;
  }) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const ref = await db.collection(POSTS_COLLECTION).add({
        // Explicit field mapping — no spread, so undefined fields become null
        // and never hit Firestore's "Cannot encode type 'undefined'" error
        userId: data.userId,
        topic: data.topic,
        content: data.content,
        scheduledFor: data.scheduledFor,
        reviewDeadline: data.reviewDeadline,
        seriesId: data.seriesId ?? null,
        topicIndex: data.topicIndex ?? null,
        previousPostSummary: data.previousPostSummary ?? null,
        inputPrompt: data.inputPrompt ?? null,
        mediaType: data.mediaType ?? 'text',
        mediaUrl: data.mediaUrl ?? null,
        mediaMimeType: data.mediaMimeType ?? null,
        mediaPrompt: data.mediaPrompt ?? null,
        linkedinMediaAsset: data.linkedinMediaAsset ?? null,
        editedContent: null,
        status: 'pending_review' as PostStatus,
        publishedAt: null,
        linkedinPostId: null,
        failureReason: null,
        retryCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    }, 'PostService.create');
  },

  /** Get a single post */
  getById(postId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(POSTS_COLLECTION).doc(postId).get();
      if (!snap.exists) return null;
      return toPost(snap.id, snap.data()!);
    }, 'PostService.getById');
  },

  /** Get all posts for a user, newest first */
  getAllByUser(userId: string, maxResults = 50) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(POSTS_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('scheduledFor', 'desc')
        .limit(maxResults)
        .get();
      return snap.docs.map(d => toPost(d.id, d.data()));
    }, 'PostService.getAllByUser');
  },

  /** Get posts by status (e.g. all pending_review posts) */
  getByStatus(userId: string, status: PostStatus) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(POSTS_COLLECTION)
        .where('userId', '==', userId)
        .where('status', '==', status)
        .orderBy('scheduledFor', 'asc')
        .get();
      return snap.docs.map(d => toPost(d.id, d.data()));
    }, 'PostService.getByStatus');
  },

  /** Get upcoming posts (scheduled in the future, approved or pending) */
  getUpcoming(userId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(POSTS_COLLECTION)
        .where('userId', '==', userId)
        .where('status', 'in', ['pending_review', 'approved'])
        .orderBy('scheduledFor', 'asc')
        .get();
      return snap.docs.map(d => toPost(d.id, d.data()));
    }, 'PostService.getUpcoming');
  },

  /** Get the most recent published post for a series (for AI continuity) */
  getLastPublishedInSeries(userId: string, seriesId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(POSTS_COLLECTION)
        .where('userId', '==', userId)
        .where('seriesId', '==', seriesId)
        .where('status', '==', 'published')
        .orderBy('publishedAt', 'desc')
        .limit(1)
        .get();
      if (snap.empty) return null;
      return toPost(snap.docs[0].id, snap.docs[0].data());
    }, 'PostService.getLastPublishedInSeries');
  },

  // ── Status transitions ───────────────────────────────────────────────────

  /** User approves the draft — optionally with edits */
  approve(postId: string, editedContent?: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      const updates: Record<string, unknown> = {
        status: 'approved',
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (editedContent !== undefined) {
        updates.editedContent = editedContent;
      }
      await db.collection(POSTS_COLLECTION).doc(postId).update(updates);
    }, 'PostService.approve');
  },

  /** User explicitly rejects the draft */
  reject(postId: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        status: 'rejected',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'PostService.reject');
  },

  /** System skips the post (review deadline passed without approval) */
  skip(postId: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        status: 'skipped',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'PostService.skip');
  },

  /** Mark post as published with the LinkedIn post ID */
  markPublished(postId: string, linkedinPostId: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        status: 'published',
        linkedinPostId,
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'PostService.markPublished');
  },

  /** Cache the LinkedIn media asset URN after uploading media at publish time */
  setLinkedinMediaAsset(postId: string, urn: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        linkedinMediaAsset: urn,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'PostService.setLinkedinMediaAsset');
  },

  /** Mark post as failed */
  markFailed(postId: string, reason: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(POSTS_COLLECTION).doc(postId).get();
      const retryCount = snap.exists ? ((snap.data()!.retryCount as number) ?? 0) : 0;
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        status: 'failed',
        failureReason: reason,
        retryCount: retryCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'PostService.markFailed');
  },

  /** Retry a failed post — resets status to approved */
  retry(postId: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        status: 'approved',
        failureReason: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'PostService.retry');
  },

  /** Update post content (user editing the draft) */
  updateContent(postId: string, editedContent: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(POSTS_COLLECTION).doc(postId).update({
        editedContent,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'PostService.updateContent');
  },
};

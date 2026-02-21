/**
 * Post Service — CRUD + lifecycle management for LinkedIn posts
 *
 * Manages the full lifecycle: pending_review → approved → published.
 * Also handles skip, reject, fail, and retry flows.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { firebaseHandler, firebaseVoidHandler } from '@/lib/firebase/handler';
import { POSTS_COLLECTION } from '../collections';
import type { Post, PostStatus } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toPost(id: string, data: Record<string, unknown>): Post {
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
  }) {
    return firebaseHandler(async () => {
      const ref = await addDoc(collection(db, POSTS_COLLECTION), {
        ...data,
        editedContent: null,
        status: 'pending_review' as PostStatus,
        publishedAt: null,
        linkedinPostId: null,
        failureReason: null,
        retryCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    }, 'PostService.create');
  },

  /** Get a single post */
  getById(postId: string) {
    return firebaseHandler(async () => {
      const snap = await getDoc(doc(db, POSTS_COLLECTION, postId));
      if (!snap.exists()) return null;
      return toPost(snap.id, snap.data());
    }, 'PostService.getById');
  },

  /** Get all posts for a user, newest first */
  getAllByUser(userId: string, maxResults = 50) {
    return firebaseHandler(async () => {
      const q = query(
        collection(db, POSTS_COLLECTION),
        where('userId', '==', userId),
        orderBy('scheduledFor', 'desc'),
        limit(maxResults),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => toPost(d.id, d.data()));
    }, 'PostService.getAllByUser');
  },

  /** Get posts by status (e.g. all pending_review posts) */
  getByStatus(userId: string, status: PostStatus) {
    return firebaseHandler(async () => {
      const q = query(
        collection(db, POSTS_COLLECTION),
        where('userId', '==', userId),
        where('status', '==', status),
        orderBy('scheduledFor', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => toPost(d.id, d.data()));
    }, 'PostService.getByStatus');
  },

  /** Get upcoming posts (scheduled in the future, approved or pending) */
  getUpcoming(userId: string) {
    return firebaseHandler(async () => {
      const q = query(
        collection(db, POSTS_COLLECTION),
        where('userId', '==', userId),
        where('status', 'in', ['pending_review', 'approved']),
        orderBy('scheduledFor', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => toPost(d.id, d.data()));
    }, 'PostService.getUpcoming');
  },

  /** Get the most recent published post for a series (for AI continuity) */
  getLastPublishedInSeries(userId: string, seriesId: string) {
    return firebaseHandler(async () => {
      const q = query(
        collection(db, POSTS_COLLECTION),
        where('userId', '==', userId),
        where('seriesId', '==', seriesId),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return toPost(snap.docs[0].id, snap.docs[0].data());
    }, 'PostService.getLastPublishedInSeries');
  },

  // ── Status transitions ───────────────────────────────────────────────────

  /** User approves the draft — optionally with edits */
  approve(postId: string, editedContent?: string) {
    return firebaseVoidHandler(async () => {
      const updates: Record<string, unknown> = {
        status: 'approved',
        updatedAt: serverTimestamp(),
      };
      if (editedContent !== undefined) {
        updates.editedContent = editedContent;
      }
      await updateDoc(doc(db, POSTS_COLLECTION, postId), updates);
    }, 'PostService.approve');
  },

  /** User explicitly rejects the draft */
  reject(postId: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, POSTS_COLLECTION, postId), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });
    }, 'PostService.reject');
  },

  /** System skips the post (review deadline passed without approval) */
  skip(postId: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, POSTS_COLLECTION, postId), {
        status: 'skipped',
        updatedAt: serverTimestamp(),
      });
    }, 'PostService.skip');
  },

  /** Mark post as published with the LinkedIn post ID */
  markPublished(postId: string, linkedinPostId: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, POSTS_COLLECTION, postId), {
        status: 'published',
        linkedinPostId,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }, 'PostService.markPublished');
  },

  /** Mark post as failed */
  markFailed(postId: string, reason: string) {
    return firebaseVoidHandler(async () => {
      const snap = await getDoc(doc(db, POSTS_COLLECTION, postId));
      const retryCount = snap.exists() ? ((snap.data().retryCount as number) ?? 0) : 0;
      await updateDoc(doc(db, POSTS_COLLECTION, postId), {
        status: 'failed',
        failureReason: reason,
        retryCount: retryCount + 1,
        updatedAt: serverTimestamp(),
      });
    }, 'PostService.markFailed');
  },

  /** Retry a failed post — resets status to approved */
  retry(postId: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, POSTS_COLLECTION, postId), {
        status: 'approved',
        failureReason: null,
        updatedAt: serverTimestamp(),
      });
    }, 'PostService.retry');
  },

  /** Update post content (user editing the draft) */
  updateContent(postId: string, editedContent: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, POSTS_COLLECTION, postId), {
        editedContent,
        updatedAt: serverTimestamp(),
      });
    }, 'PostService.updateContent');
  },
};

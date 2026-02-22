/**
 * Series Service — CRUD for topic series
 *
 * A "series" is an ordered list of topics the AI should cover.
 * The system advances `currentIndex` by 1 each time a post is published
 * or skipped, and auto-completes the series when the queue is exhausted.
 */

import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { firebaseHandler, firebaseVoidHandler } from '@/lib/firebase/handler';
import { SERIES_COLLECTION } from '../collections';
import type { Series, SeriesStatus, SeriesTopic } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Firestore timestamp fields to JS Dates */
function toSeries(id: string, data: FirebaseFirestore.DocumentData): Series {
  return {
    ...data,
    id,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
  } as Series;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const SeriesService = {
  /**
   * Create a new series.
   * `currentIndex` starts at 0 and `status` defaults to 'active'.
   */
  create(userId: string, data: {
    title: string;
    category: string;
    topicQueue: SeriesTopic[];
    order?: number;
    templateId?: string;
  }) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const ref = await db.collection(SERIES_COLLECTION).add({
        userId,
        title: data.title,
        category: data.category,
        topicQueue: data.topicQueue,
        currentIndex: 0,
        status: 'active' as SeriesStatus,
        order: data.order ?? 0,
        templateId: data.templateId ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    }, 'SeriesService.create');
  },

  /** Get a single series by ID */
  getById(seriesId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(SERIES_COLLECTION).doc(seriesId).get();
      if (!snap.exists) return null;
      return toSeries(snap.id, snap.data()!);
    }, 'SeriesService.getById');
  },

  /** Get all series for a user, ordered by priority */
  getAllByUser(userId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(SERIES_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('order', 'asc')
        .get();
      return snap.docs.map(d => toSeries(d.id, d.data()));
    }, 'SeriesService.getAllByUser');
  },

  /** Get the currently active series (lowest order, status = 'active') */
  getActiveSeries(userId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(SERIES_COLLECTION)
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .orderBy('order', 'asc')
        .get();
      if (snap.empty) return null;
      const d = snap.docs[0];
      return toSeries(d.id, d.data());
    }, 'SeriesService.getActiveSeries');
  },

  /** Update series fields (title, category, topicQueue, status, order, templateId) */
  update(seriesId: string, data: Partial<Pick<Series, 'title' | 'category' | 'topicQueue' | 'status' | 'order' | 'templateId'>>) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(SERIES_COLLECTION).doc(seriesId).update({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'SeriesService.update');
  },

  /**
   * Advance the current index by 1.
   * If the index reaches the end of the queue, auto-set status to 'completed'.
   */
  advanceIndex(seriesId: string, currentLength: number, currentIndex: number) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      const nextIndex = currentIndex + 1;
      const updates: Record<string, unknown> = {
        currentIndex: nextIndex,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (nextIndex >= currentLength) {
        updates.status = 'completed';
      }
      await db.collection(SERIES_COLLECTION).doc(seriesId).update(updates);
    }, 'SeriesService.advanceIndex');
  },

  /** Delete a series (does NOT delete associated posts) */
  delete(seriesId: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(SERIES_COLLECTION).doc(seriesId).delete();
    }, 'SeriesService.delete');
  },
};

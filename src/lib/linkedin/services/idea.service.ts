/**
 * Idea Service — CRUD for the manual idea bank
 *
 * Ideas are short notes the user logs throughout the day.
 * During the nightly draft-generation run, the system checks if there's
 * an unused idea for today's series (or standalone) and uses it instead of
 * the next auto-topic in the series queue.
 */

import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { firebaseHandler, firebaseVoidHandler } from '@/lib/firebase/handler';
import { IDEAS_COLLECTION } from '../collections';
import type { Idea } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toIdea(id: string, data: FirebaseFirestore.DocumentData): Idea {
  return {
    ...data,
    id,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
  } as Idea;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const IdeaService = {
  /** Add a new idea */
  create(userId: string, data: { text: string; seriesId?: string }) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const ref = await db.collection(IDEAS_COLLECTION).add({
        userId,
        text: data.text,
        seriesId: data.seriesId ?? null,
        used: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    }, 'IdeaService.create');
  },

  /** Get a single idea */
  getById(ideaId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(IDEAS_COLLECTION).doc(ideaId).get();
      if (!snap.exists) return null;
      return toIdea(snap.id, snap.data()!);
    }, 'IdeaService.getById');
  },

  /** Get all unused ideas for a user */
  getUnused(userId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(IDEAS_COLLECTION)
        .where('userId', '==', userId)
        .where('used', '==', false)
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map(d => toIdea(d.id, d.data()));
    }, 'IdeaService.getUnused');
  },

  /** Get the oldest unused idea — optionally scoped to a series */
  getNextUnused(userId: string, seriesId?: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      let q = db.collection(IDEAS_COLLECTION)
        .where('userId', '==', userId)
        .where('used', '==', false);
      if (seriesId) q = q.where('seriesId', '==', seriesId) as typeof q;
      const snap = await q.orderBy('createdAt', 'asc').limit(1).get();
      if (snap.empty) return null;
      return toIdea(snap.docs[0].id, snap.docs[0].data());
    }, 'IdeaService.getNextUnused');
  },

  /** Get all ideas (including used) for a user */
  getAllByUser(userId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(IDEAS_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map(d => toIdea(d.id, d.data()));
    }, 'IdeaService.getAllByUser');
  },

  /** Mark an idea as consumed */
  markUsed(ideaId: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(IDEAS_COLLECTION).doc(ideaId).update({ used: true });
    }, 'IdeaService.markUsed');
  },

  /** Update idea text */
  update(ideaId: string, text: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(IDEAS_COLLECTION).doc(ideaId).update({ text });
    }, 'IdeaService.update');
  },

  /** Delete an idea */
  delete(ideaId: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(IDEAS_COLLECTION).doc(ideaId).delete();
    }, 'IdeaService.delete');
  },
};

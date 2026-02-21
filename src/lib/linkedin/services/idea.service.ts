/**
 * Idea Service — CRUD for the manual idea bank
 *
 * Ideas are short notes the user logs throughout the day.
 * During the nightly draft-generation run, the system checks if there's
 * an unused idea for today's series (or standalone) and uses it instead of
 * the next auto-topic in the series queue.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { firebaseHandler, firebaseVoidHandler } from '@/lib/firebase/handler';
import { IDEAS_COLLECTION } from '../collections';
import type { Idea } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toIdea(id: string, data: Record<string, unknown>): Idea {
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
      const ref = await addDoc(collection(db, IDEAS_COLLECTION), {
        userId,
        text: data.text,
        seriesId: data.seriesId ?? null,
        used: false,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    }, 'IdeaService.create');
  },

  /** Get a single idea */
  getById(ideaId: string) {
    return firebaseHandler(async () => {
      const snap = await getDoc(doc(db, IDEAS_COLLECTION, ideaId));
      if (!snap.exists()) return null;
      return toIdea(snap.id, snap.data());
    }, 'IdeaService.getById');
  },

  /** Get all unused ideas for a user */
  getUnused(userId: string) {
    return firebaseHandler(async () => {
      const q = query(
        collection(db, IDEAS_COLLECTION),
        where('userId', '==', userId),
        where('used', '==', false),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => toIdea(d.id, d.data()));
    }, 'IdeaService.getUnused');
  },

  /** Get the oldest unused idea — optionally scoped to a series */
  getNextUnused(userId: string, seriesId?: string) {
    return firebaseHandler(async () => {
      const constraints = [
        where('userId', '==', userId),
        where('used', '==', false),
        ...(seriesId ? [where('seriesId', '==', seriesId)] : []),
        orderBy('createdAt', 'asc'),
        limit(1),
      ];
      const q = query(collection(db, IDEAS_COLLECTION), ...constraints);
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return toIdea(snap.docs[0].id, snap.docs[0].data());
    }, 'IdeaService.getNextUnused');
  },

  /** Get all ideas (including used) for a user */
  getAllByUser(userId: string) {
    return firebaseHandler(async () => {
      const q = query(
        collection(db, IDEAS_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => toIdea(d.id, d.data()));
    }, 'IdeaService.getAllByUser');
  },

  /** Mark an idea as consumed */
  markUsed(ideaId: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, IDEAS_COLLECTION, ideaId), { used: true });
    }, 'IdeaService.markUsed');
  },

  /** Update idea text */
  update(ideaId: string, text: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, IDEAS_COLLECTION, ideaId), { text });
    }, 'IdeaService.update');
  },

  /** Delete an idea */
  delete(ideaId: string) {
    return firebaseVoidHandler(async () => {
      await deleteDoc(doc(db, IDEAS_COLLECTION, ideaId));
    }, 'IdeaService.delete');
  },
};

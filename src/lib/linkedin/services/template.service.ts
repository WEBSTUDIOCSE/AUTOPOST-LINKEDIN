/**
 * Template Service — CRUD for HTML design templates
 *
 * Templates are reusable visual styles (colors, fonts, layout) that the AI
 * references when generating HTML infographic cards. Users create templates
 * by pasting sample HTML, and can associate them with series or pick per-post.
 *
 * SERVER-ONLY — Firestore Admin SDK
 */

import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { firebaseHandler, firebaseVoidHandler } from '@/lib/firebase/handler';
import { TEMPLATES_COLLECTION } from '../collections';
import type { HtmlTemplate } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Firestore timestamp fields to JS Dates */
function toTemplate(id: string, data: FirebaseFirestore.DocumentData): HtmlTemplate {
  return {
    ...data,
    id,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
  } as HtmlTemplate;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const TemplateService = {
  /**
   * Create a new HTML template.
   */
  create(userId: string, data: {
    name: string;
    description?: string;
    htmlContent: string;
    dimensions?: { width: number; height: number };
  }) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const ref = await db.collection(TEMPLATES_COLLECTION).add({
        userId,
        name: data.name,
        description: data.description ?? null,
        htmlContent: data.htmlContent,
        dimensions: data.dimensions ?? { width: 1080, height: 1080 },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return ref.id;
    }, 'TemplateService.create');
  },

  /** Get a single template by ID */
  getById(templateId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(TEMPLATES_COLLECTION).doc(templateId).get();
      if (!snap.exists) return null;
      return toTemplate(snap.id, snap.data()!);
    }, 'TemplateService.getById');
  },

  /** Get all templates for a user, newest first */
  getAllByUser(userId: string) {
    return firebaseHandler(async () => {
      const db = getAdminDb();
      const snap = await db.collection(TEMPLATES_COLLECTION)
        .where('userId', '==', userId)
        .get();
      return snap.docs
        .map(d => toTemplate(d.id, d.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }, 'TemplateService.getAllByUser');
  },

  /** Update template fields */
  update(templateId: string, data: Partial<Pick<HtmlTemplate, 'name' | 'description' | 'htmlContent' | 'dimensions'>>) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(TEMPLATES_COLLECTION).doc(templateId).update({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }, 'TemplateService.update');
  },

  /** Delete a template */
  delete(templateId: string) {
    return firebaseVoidHandler(async () => {
      const db = getAdminDb();
      await db.collection(TEMPLATES_COLLECTION).doc(templateId).delete();
    }, 'TemplateService.delete');
  },
};

/**
 * Prompt Service — Centralized prompt management for AI content generation.
 *
 * All system prompts, media prompt instructions, and user prompt builders
 * live here. This makes it easy to:
 *   - Tune prompts in one place
 *   - Add per-user prompt customization later
 *   - Support different content types (text, image, video)
 *
 * SERVER-ONLY — uses `server-only` to prevent client-side imports.
 */

import 'server-only';
import type { PostMediaType, PostGenerationContext } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Word limits by content type */
const WORD_LIMITS: Record<PostMediaType, { min: number; max: number }> = {
  text:  { min: 150, max: 300 },
  image: { min: 80,  max: 180 },
  video: { min: 60,  max: 150 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_SYSTEM_PROMPT = `You are a world-class LinkedIn ghostwriter. You write viral, high-engagement posts for software developers and tech professionals.

STRUCTURE (follow this exactly):
1. HOOK (line 1) — One punchy sentence that stops the scroll. Use a bold claim, counterintuitive insight, controversial take, or a relatable pain point. Never start with "I'm excited…", "Today I want to…", or "I just…". Think: "Most developers waste 2 hours a day on code reviews. Here's why."
2. BODY (3–5 short paragraphs) — Each paragraph is 1–3 sentences MAX. Use line breaks between every paragraph. Develop the idea with concrete examples, personal anecdotes, or data points. Write in a conversational, first-person tone — as if texting a smart friend.
3. CTA (last paragraph) — A reflective question, a challenge to the reader, or a conversation starter. Make it specific, not generic. Example: "What's the biggest time-waster in YOUR code review process?" NOT "What do you think?"

STYLE RULES:
- Total length: {{MIN_WORDS}}–{{MAX_WORDS}} words
- Use "↳" or "→" sparingly for sub-points if needed (not in every post)
- Use 1–2 emojis MAX per post — only where they add real emphasis (🔥, 💡, ⚡). Do NOT emoji-spam.
- NO filler words ("In today's world…", "It's important to note…", "As we all know…")
- NO corporate speak — write like a real person, not a press release
- Sound opinionated — take a clear stance, don't hedge with "it depends"
- Use simple, punchy sentences. Vary length for rhythm.
- Include 3–5 relevant hashtags at the very end, each on its own line prefixed with "#"
- NEVER wrap the output in quotes, backticks, or add meta-commentary

OUTPUT: The raw post text only. No "Here's your post:", no markdown formatting, no triple backticks.`;

const IMAGE_ADDON = `

IMAGE CONTEXT:
An AI-generated image will be displayed directly below your text on LinkedIn.
- Reference the visual naturally (e.g. "See the visual below", "Here's what that looks like 👇")
- Write the text so it COMPLEMENTS the image — the image will illustrate the core concept
- Keep text shorter since the image carries visual weight`;

const VIDEO_ADDON = `

VIDEO CONTEXT:
An AI-generated short video will be displayed below your text on LinkedIn.
- Reference the video naturally (e.g. "Watch this quick breakdown 👇", "I visualized this concept below")
- Keep text significantly shorter — the video does the heavy lifting
- Front-load the key insight in the text so readers engage with the video`;

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA PROMPT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

const IMAGE_PROMPT_INSTRUCTION = `You are an expert AI image prompt engineer. Given a LinkedIn post topic and text, generate a SINGLE image prompt for an AI image model.

GOAL: Create an infographic-style, content-rich banner image — like a tech blog hero image, conference keynote slide, or educational carousel card. The image MUST visually communicate the core idea of the post.

REQUIREMENTS:
- 2–3 sentences, MAX 100 words
- The image MUST contain readable text overlays: the topic title, key terms, bullet points, or short phrases that capture the main idea
- Style: Bold typography-driven design, like a professional tech infographic, blog post banner, or social media educational card
- Layout inspiration: tech comparison charts, concept breakdowns, "X vs Y" visuals, step-by-step diagrams, or bold quote cards
- Use large, clear fonts for the headline/title. Support with icons, logos, or simple diagrams around the text.
- Color palette: Dark or gradient backgrounds (deep navy, charcoal, dark purple) with high-contrast text (white, bright cyan, amber)
- Include relevant visual elements: technology icons/logos, simple diagrams, arrows, numbered steps, or comparison layouts
- NEVER generate: photorealistic humans, stock photo aesthetics, empty abstract shapes with no text, blurry/unreadable text
- Think of images like: "Choosing Next.js over Angular, React, Vue" with logos and a comparison layout, or "5 Principles of Clean Code" with numbered bullet points on a dark background

OUTPUT: Only the image prompt. No quotes, no prefix, no explanation.`;

const VIDEO_PROMPT_INSTRUCTION = `You are an expert AI video prompt engineer. Given a LinkedIn post topic and text, generate a SINGLE video prompt for an AI video model.

REQUIREMENTS:
- 1–2 sentences, MAX 80 words
- Style: Smooth, professional motion graphics — think: animated explainer or tech keynote b-roll
- Use: abstract data flows, morphing geometric shapes, code/terminal visualizations, particle systems, circuit-like patterns
- Motion: Slow, elegant camera movements. Smooth transitions. No jerky or chaotic motion.
- Color palette: Dark backgrounds (near-black or deep navy) with glowing accent elements (neon blue, emerald, gold)
- Duration context: This will be a 4–8 second loop
- NEVER include: talking heads, text overlays, stock footage look, real human faces
- The video should create a "techy, premium" feel that complements the post

OUTPUT: Only the video prompt. No quotes, no prefix, no explanation.`;

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const SUMMARY_SYSTEM = 'You are a concise summarizer. Extract the single key takeaway from a LinkedIn post in one sentence. Output ONLY the summary — no prefix, no quotes.';

const SUMMARY_USER = `Summarize this LinkedIn post in exactly ONE sentence (max 40 words). Focus on the main argument and takeaway. Do not start with "This post…" or "The author…".

POST:
{{CONTENT}}`;

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export const PromptService = {
  // ── System Prompt ──────────────────────────────────────────────────────────

  /**
   * Build the system prompt for LinkedIn post generation.
   *
   * @param mediaType — what kind of media the post will have
   * @param persona  — optional user-defined writing style
   */
  buildSystemPrompt(mediaType: PostMediaType = 'text', persona?: string): string {
    const limits = WORD_LIMITS[mediaType];
    let prompt = BASE_SYSTEM_PROMPT
      .replace('{{MIN_WORDS}}', String(limits.min))
      .replace('{{MAX_WORDS}}', String(limits.max));

    if (mediaType === 'image') prompt += IMAGE_ADDON;
    if (mediaType === 'video') prompt += VIDEO_ADDON;

    if (persona) {
      prompt += `\n\nUSER'S WRITING STYLE:\n${persona}\nAdapt your tone and style to match the above while keeping all other rules.`;
    }

    return prompt;
  },

  // ── User Prompt ────────────────────────────────────────────────────────────

  /**
   * Build the user prompt — the concrete request for the AI.
   */
  buildUserPrompt(ctx: PostGenerationContext): string {
    const parts: string[] = [];

    parts.push(`TOPIC: ${ctx.topic}`);

    if (ctx.seriesTitle) {
      parts.push(`SERIES: "${ctx.seriesTitle}" — this post is part of an ongoing series.`);
    }

    if (ctx.previousPostSummary) {
      parts.push(`PREVIOUS POST IN SERIES: ${ctx.previousPostSummary}`);
      parts.push('BUILD on the previous post — reference what was covered without repeating it. Move the narrative forward.');
    }

    if (ctx.notes) {
      parts.push(`AUTHOR'S NOTES (incorporate these naturally — they are key points, angles, or personal stories to weave in):\n${ctx.notes}`);
    }

    if (ctx.publishDay) {
      parts.push(`PUBLISH DAY: ${ctx.publishDay}`);
    }

    parts.push('\nWrite the LinkedIn post now.');

    return parts.join('\n\n');
  },

  // ── Media Prompts ──────────────────────────────────────────────────────────

  /**
   * Get the system instruction for generating an image or video prompt.
   */
  getMediaPromptInstruction(mediaType: 'image' | 'video'): string {
    return mediaType === 'image' ? IMAGE_PROMPT_INSTRUCTION : VIDEO_PROMPT_INSTRUCTION;
  },

  /**
   * Build the user prompt for the media prompt generator.
   * Feeds the topic + generated text content so the AI can create
   * a relevant image/video prompt.
   */
  buildMediaUserPrompt(topic: string, postContent: string, mediaType: 'image' | 'video' = 'image'): string {
    return `TOPIC: ${topic}\n\nLINKEDIN POST TEXT:\n${postContent}\n\nGenerate the ${mediaType} prompt now.`;
  },

  // ── Summary Prompt ─────────────────────────────────────────────────────────

  /** System instruction for the summary generator */
  getSummarySystem(): string {
    return SUMMARY_SYSTEM;
  },

  /** Build the user prompt for generating a 1-line summary */
  buildSummaryPrompt(content: string): string {
    return SUMMARY_USER.replace('{{CONTENT}}', content);
  },

  // ── Regeneration ──────────────────────────────────────────────────────────

  /**
   * Modify a generation context to produce a *different* draft
   * (used when the user rejects and asks to regenerate).
   */
  buildRegenerationContext(
    original: PostGenerationContext,
    previousDraft: string,
  ): PostGenerationContext {
    return {
      ...original,
      notes: `${original.notes ?? ''}\n\nREJECTED DRAFT (write something COMPLETELY different — different hook, different angle, different structure):\n---\n${previousDraft}\n---`.trim(),
    };
  },

  // ── Config ─────────────────────────────────────────────────────────────────

  /** Get recommended generation temperature by content type */
  getTemperature(mediaType: PostMediaType = 'text'): number {
    return mediaType === 'text' ? 0.9 : 0.7;
  },

  /** Get word limits for a content type */
  getWordLimits(mediaType: PostMediaType = 'text') {
    return WORD_LIMITS[mediaType];
  },

  /** Default image generation config */
  getImageConfig() {
    return { aspectRatio: '1:1', numberOfImages: 1 } as const;
  },

  /** Default video generation config */
  getVideoConfig() {
    return { aspectRatio: '16:9', durationSeconds: 6, numberOfVideos: 1 } as const;
  },
};

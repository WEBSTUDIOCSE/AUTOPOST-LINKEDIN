/**
 * AI Post Generation Service
 *
 * Uses the existing AI adapter layer (Gemini / KieAI) to generate
 * LinkedIn post drafts from topic + context.
 *
 * This is a SERVER-ONLY module — it accesses API keys and should never
 * be imported from a Client Component.
 */

import { createAIAdapter } from '@/lib/ai';
import { getAIConfig, getCurrentAIProvider } from '@/lib/firebase/config/environments';
import type { PostGenerationContext } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(persona?: string): string {
  const base = `You are a LinkedIn post ghostwriter for a software developer.

RULES:
- Write in first person as if the developer is writing
- Keep posts between 150–300 words (LinkedIn sweet spot)
- Use short paragraphs (2-3 sentences max)
- Open with a hook — a bold statement, question, or surprising fact
- End with a call-to-action or reflective question
- Use line breaks between paragraphs for readability
- Include 3-5 relevant hashtags at the end
- Use emojis sparingly (max 2-3 per post) — professional but approachable
- Never use clickbait or false claims
- Never start with "I'm excited to share..." or similar clichés
- Sound authentic, not corporate
- If this is a continuation of a series, naturally reference what was covered previously
- Output ONLY the post text — no meta commentary, no "here's your post", no triple backticks`;

  if (persona) {
    return `${base}\n\nWRITING STYLE / PERSONA:\n${persona}`;
  }

  return base;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

function buildUserPrompt(ctx: PostGenerationContext): string {
  const parts: string[] = [];

  parts.push(`TOPIC: ${ctx.topic}`);

  if (ctx.seriesTitle) {
    parts.push(`SERIES: "${ctx.seriesTitle}"`);
  }

  if (ctx.previousPostSummary) {
    parts.push(`PREVIOUS POST SUMMARY: ${ctx.previousPostSummary}`);
    parts.push('Continue naturally from the previous post. Reference what was covered but don\'t repeat it.');
  }

  if (ctx.notes) {
    parts.push(`ADDITIONAL CONTEXT / NOTES:\n${ctx.notes}`);
  }

  parts.push(`PUBLISH DAY: ${ctx.publishDay}`);

  parts.push('\nWrite the LinkedIn post now.');

  return parts.join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface GeneratedPost {
  content: string;
  /** Short 1-line summary for feeding to the next post as context */
  summary: string;
}

/**
 * Generate a LinkedIn post draft using the configured AI provider.
 *
 * @param context — topic, series info, continuity data, persona
 * @returns The generated post content + a summary for the next draft
 */
export async function generatePostDraft(context: PostGenerationContext): Promise<GeneratedPost> {
  const config = getAIConfig();
  const adapter = createAIAdapter(config);

  // 1. Generate the main post
  const postResult = await adapter.generateText({
    prompt: buildUserPrompt(context),
    systemInstruction: buildSystemPrompt(context.persona),
    temperature: 0.8,   // creative but not wild
    maxTokens: 1024,
  });

  const content = postResult.text.trim();

  // 2. Generate a short summary (for continuity with the next post)
  const summaryResult = await adapter.generateText({
    prompt: `Summarize this LinkedIn post in exactly ONE sentence (max 50 words). Focus on the key topic and takeaway:\n\n${content}`,
    systemInstruction: 'You are a concise summarizer. Output only the summary sentence, nothing else.',
    temperature: 0.3,
    maxTokens: 100,
  });

  return {
    content,
    summary: summaryResult.text.trim(),
  };
}

/**
 * Regenerate — same as generate but with a "try a different angle" hint.
 * Useful when the user rejects a draft and wants alternatives.
 */
export async function regeneratePostDraft(
  context: PostGenerationContext,
  previousDraft: string,
): Promise<GeneratedPost> {
  const tweakedContext: PostGenerationContext = {
    ...context,
    notes: `${context.notes ?? ''}\n\nIMPORTANT: A previous draft was rejected. Here it is for reference — write something DIFFERENT in tone, hook, and structure:\n---\n${previousDraft}\n---`.trim(),
  };

  return generatePostDraft(tweakedContext);
}

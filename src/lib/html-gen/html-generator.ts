/**
 * HTML Infographic Generator
 *
 * Asks the AI to produce a self-contained HTML infographic for a topic.
 * The HTML is stored in Firestore and rendered in an iframe for preview.
 * At publish time the client converts HTML → PNG via html2canvas.
 *
 * KEY RULES FOR THE AI:
 *   - All CSS must be embedded (no external CDN, no Tailwind CDN script)
 *   - No JavaScript allowed (it won't run in a sandboxed iframe)
 *   - Target viewport: 1200×627px (LinkedIn landscape)
 *   - Self-contained: one complete HTML document
 *
 * SERVER-ONLY
 */

import 'server-only';
import type { IAIAdapter } from '@/lib/ai/adapter.interface';

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

function buildHtmlPrompt(topic: string, postContent: string): string {
  const snippet = postContent.slice(0, 300);

  return `You are a world-class web designer. Generate a single, self-contained HTML infographic that visually explains the given topic.

STRICT REQUIREMENTS:
1. Output a complete HTML document (<!DOCTYPE html> through </html>).
2. ALL styling in a single <style> block inside <head>. NO external stylesheets, NO CDN links, NO <script> tags.
3. Keep CSS concise: use shorthand properties, reuse classes, avoid repetitive selectors.
4. The design MUST look stunning:
   - Dark gradient backgrounds (deep navy, charcoal, dark purple)
   - Bold, clean typography with large headings (use system fonts: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)
   - Accent colors (cyan #06b6d4, amber #f59e0b, emerald #10b981, purple #8b5cf6) for highlights
   - Rounded cards with subtle borders and glass-morphism effects (rgba backgrounds, backdrop-filter)
   - Emojis as icons where appropriate
   - Clear visual hierarchy: big title → sections → details
5. Outer container: EXACTLY width:1200px; height:627px; overflow:hidden; margin:0; padding:0 on html and body too.
6. Use flexbox and grid for layout. Modern CSS only.
7. FACTUAL ACCURACY IS CRITICAL:
   - Every tech fact, comparison, or statement MUST be correct
   - Do NOT make up version numbers, stats, or performance claims unless they are widely known facts
   - If comparing technologies, ensure the differences are real and accurate
   - Double-check: Is this claim true? Would a senior developer agree with this?
8. Keep text SHORT and punchy — this is a visual card, not an article. Max 6-8 short text blocks.
9. IMPORTANT: You MUST output the COMPLETE HTML document. Do NOT stop mid-document. Always close every tag and end with </html>.
10. Add this CSS to html and body: html, body { margin: 0; padding: 0; width: 1200px; height: 627px; overflow: hidden; }

LAYOUT (pick the best fit for the topic):
- Split comparison (X vs Y) — two columns with key differences
- Numbered list / tips card — 4-6 concise tips with icons
- Stats dashboard — big numbers with labels
- Code snippet showcase — syntax-highlighted code with explanation
- Flow diagram — step-by-step process with arrows
- Quote + key points — hero quote with supporting bullets

TOPIC: ${topic}

POST CONTEXT (for reference):
${snippet}

OUTPUT: Return ONLY the complete HTML document. No markdown fencing, no explanation.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up AI response — strip markdown fences, validate it's HTML.
 */
function parseHtmlResponse(raw: string): string {
  let html = raw.trim();

  // Strip markdown code blocks  
  if (html.startsWith('```')) {
    html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
  }

  // Basic sanity check
  if (!html.includes('<!DOCTYPE html') && !html.includes('<html')) {
    throw new Error('[html-gen] AI did not return valid HTML');
  }

  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a self-contained HTML infographic for a topic.
 *
 * @param adapter     — AI text adapter (Gemini, KieAI)
 * @param topic       — Post topic
 * @param postContent — Generated post text (for context)
 * @returns Complete HTML string ready to store in Firestore
 */
export async function generateHtmlCard(
  adapter: IAIAdapter,
  topic: string,
  postContent: string,
): Promise<string> {
  const prompt = buildHtmlPrompt(topic, postContent);

  const result = await adapter.generateText({
    prompt,
    systemInstruction: 'You are an HTML generator. Output ONLY a complete, valid HTML document. No markdown, no explanation. You MUST finish the entire document — always end with </body></html>.',
    temperature: 0.5,
    maxTokens: 8000,
  });

  return parseHtmlResponse(result.text);
}

/**
 * HTML Infographic Generator — Single-Page (Viewport-Sliced Carousel)
 *
 * Generates ONE self-contained HTML document. For multi-page carousels, the AI
 * produces a single tall document with enough content for N pages. The client
 * then slices it into fixed-height viewport regions and captures each region as
 * a separate PNG for the LinkedIn carousel.
 *
 * KEY RULES FOR THE AI:
 *   - All CSS must be embedded (inline <style>)
 *   - No JavaScript (sandboxed iframe)
 *   - Self-contained: complete HTML document
 *
 * SERVER-ONLY
 */

import 'server-only';
import type { IAIAdapter } from '@/lib/ai/adapter.interface';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface HtmlGenOptions {
  /** AI adapter for text generation */
  adapter: IAIAdapter;
  /** Post topic */
  topic: string;
  /** Generated post text (for context) */
  postContent: string;
  /** Optional template HTML to match styling from */
  templateHtml?: string;
  /**
   * Target dimensions.
   * - `{ width, height }` — fixed size, overflow hidden.
   * - `{ width }` only (height omitted/0) — fixed width, auto height (content flows naturally).
   * - Omitted entirely — defaults to 1080×1080 (square).
   */
  dimensions?: { width: number; height?: number };
  /**
   * Number of carousel pages (1 = single card, 2-9 = multi-page carousel).
   * When > 1: AI generates one tall document with enough content for N pages.
   * The client slices it into fixed-height viewport regions at capture time.
   */
  pageCount?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

function buildDefaultPrompt(topic: string, snippet: string, w: number, h: number | null, pageCount: number): string {
  const isMultiPage = pageCount > 1;
  const pageH = h ?? w; // Default page height = width (square)
  const totalH = isMultiPage ? pageH * pageCount : (h ?? w);

  const sizeRule = `html,body{margin:0;padding:0;width:${w}px;height:${totalH}px;overflow:hidden;}`;

  const contentGuide = isMultiPage
    ? `Create a SINGLE HTML document that teaches this topic across ${pageCount} visual sections. Each section should fill exactly ${pageH}px of vertical space (total height: ${totalH}px).

CONTENT — spread across ${pageCount} sections (each ${w}×${pageH}px):
- Section 1 (0-${pageH}px): Title section — topic name, a compelling one-liner, and striking visual design.
${pageCount > 2 ? `- Sections 2-${pageCount - 1} (${pageH}-${pageH * (pageCount - 1)}px): Deep-dive sections — each covers ONE concept with heading, 2-4 sentences, and optional code/diagram.` : `- Section 2 (${pageH}-${totalH}px): Deep-dive — cover the main concept with heading, explanation, code/diagram.`}
- Last section (${pageH * (pageCount - 1)}-${totalH}px): Summary/takeaway — key points recap, a call-to-action.

IMPORTANT: Content MUST fill all ${totalH}px of vertical space evenly. Each section should be visually distinct but flow naturally. Avoid cramming or leaving large empty gaps.`
    : `Create a SINGLE HTML document that teaches this topic with real depth and clarity.

CONTENT — Most important:
Explain the topic the way a leading expert would. Include:
- A clear title and compelling intro
- 2-4 key concepts with headings and explanations
- Optional code snippets or diagrams
- A takeaway or call-to-action`;

  return `You are a world-class expert in the field of "${topic}". ${contentGuide}

DESIGN — Full creative freedom. Pick a cohesive theme, color palette, and layout that suits this topic.

TECHNICAL RULES (strict):
- Output a SINGLE complete HTML document (<!DOCTYPE html> through </html>).
- All CSS in one <style> block. No external CSS, no CDN links, no <script> tags.
- No backdrop-filter. Use box-shadow for depth instead.
- CSS: ${sizeRule}
- Content MUST fit within the dimensions. Do NOT let text overflow or get cut off.

TOPIC: ${topic}
CONTEXT: ${snippet}

Return ONLY the complete HTML document. No markdown, no explanation.`;
}

/**
 * Prepare a template for use as a style reference.
 *
 * Strips <style>, <script>, and <link> tags so the AI sees the full HTML
 * *structure* (including footer, terminal bar, etc.) without any bulky CSS or
 * Tailwind config. This keeps the reference compact (usually < 3 KB) while
 * still giving the AI every structural element to reproduce.
 *
 * The extracted color palette is injected as a comment so the AI can pick up
 * the brand colors even though the style blocks are gone.
 */
function stripTemplateForReference(html: string): string {
  // 1. Extract hex colors before stripping
  const hexColors = [...new Set(html.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])].slice(0, 24);
  const palette = hexColors.length
    ? `<!-- TEMPLATE COLOR PALETTE (use these exactly): ${hexColors.join(', ')} -->`
    : '';

  // 2. Extract font families before stripping
  const fontMatches = html.match(/['"]([A-Za-z][A-Za-z0-9 ]+)['"](?=[,;\s]*(?:monospace|sans-serif|serif))/g) ?? [];
  const fonts = [...new Set(fontMatches)].slice(0, 4).join(', ');
  const fontHint = fonts ? `<!-- TEMPLATE FONTS: ${fonts} -->` : '';

  // 3. Extract decorative CSS patterns BEFORE stripping <style> blocks.
  //    These are the exact rules the AI must reproduce (dot-grid bg, glows, etc.)
  //    Without this, the AI never knows the dot-matrix background exists.
  const styleBlock = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) ?? [])[1] ?? '';
  const decorativeRules: string[] = [];

  // background-image (dot-matrix radial-gradient, texture patterns)
  (styleBlock.match(/background-image\s*:[^;}]+/g) ?? []).slice(0, 3)
    .forEach(r => decorativeRules.push(r.trim()));

  // background-size (e.g. 32px 32px for dot grids)
  (styleBlock.match(/background-size\s*:[^;}]+/g) ?? []).slice(0, 2)
    .forEach(r => decorativeRules.push(r.trim()));

  // Gradient backgrounds on the container
  (styleBlock.match(/background\s*:\s*[^;}]*(?:radial|linear)-gradient[^;}]*/g) ?? []).slice(0, 2)
    .forEach(r => decorativeRules.push(r.trim()));

  const decorativeHint = decorativeRules.length
    ? `<!-- DECORATIVE CSS (copy these rules verbatim into your .container/.dot or .bg class):\n     ${decorativeRules.join(';\n     ')} -->`
    : '';

  // 4. Strip heavy blocks — keep full HTML body structure (title bar, content, footer)
  let stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  stripped = stripped.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  stripped = stripped.replace(/<link\b[^>]*>/gi, '');
  stripped = stripped.replace(/\n{3,}/g, '\n\n').trim();

  // 5. Inject all hints right after <head>
  const hints = [palette, fontHint, decorativeHint].filter(Boolean).join('\n');
  if (hints) {
    stripped = stripped.replace(/<head>/i, `<head>\n${hints}`);
  }

  return stripped;
}

function buildTemplatePrompt(
  topic: string,
  snippet: string,
  templateHtml: string,
  w: number,
  h: number | null,
  pageCount: number,
): string {
  // Strip CSS/scripts — keep the HTML structure so the AI sees key sections.
  // Hard-cap at 2000 chars to prevent oversized prompts causing Gemini 500s.
  const stripped = stripTemplateForReference(templateHtml);
  const templateRef = stripped.length > 2000
    ? stripped.slice(0, 2000) + '\n<!-- [truncated for brevity] -->'
    : stripped;

  const isMultiPage = pageCount > 1;
  const pageH = h ?? w;
  const totalH = isMultiPage ? pageH * pageCount : (h ?? w);

  const sizeCSS = `html, body { margin: 0; padding: 0; width: ${w}px; height: ${totalH}px; overflow: hidden; }`;

  const contentGuide = isMultiPage
    ? `Create a SINGLE HTML document that teaches this topic across ${pageCount} visual sections. Each section should fill exactly ${pageH}px of vertical space (total height: ${totalH}px).

CONTENT — spread across ${pageCount} sections (each ${w}×${pageH}px):
- Section 1 (0-${pageH}px): Title section — topic name, a compelling one-liner.
${pageCount > 2 ? `- Sections 2-${pageCount - 1} (${pageH}-${pageH * (pageCount - 1)}px): Deep-dive sections — each covers ONE concept with heading, 2-4 sentences, and optional code.` : `- Section 2 (${pageH}-${totalH}px): Deep-dive — cover the main concept with heading, explanation, code/diagram.`}
- Last section (${pageH * (pageCount - 1)}-${totalH}px): Summary/takeaway — key points, a call-to-action.

IMPORTANT: Content MUST fill all ${totalH}px of vertical space evenly. Each section should be visually distinct but flow naturally.`
    : `Create a SINGLE HTML document that teaches this topic with real depth and clarity.

CONTENT:
- A clear title and compelling intro
- 2-4 key concepts with headings and explanations
- Optional code snippets
- A takeaway or call-to-action`;

  return `You are a world-class expert in the field of "${topic}". ${contentGuide}

TEMPLATE RULES (copy ONLY these three things from the template — nothing else):
1. BACKGROUND: use the exact background color + decorative pattern from the DECORATIVE CSS hint.
2. HEADER: reproduce the header/title bar structure exactly (same style, same layout).
3. FOOTER: reproduce the footer/terminal bar structure exactly (same style, same layout).
Everything between header and footer is YOUR creative space — design it freely.

DESIGN — All sections share the template's bg + header + footer. Content area layout is your creative space.

TECHNICAL RULES (strict):
- Output a SINGLE complete HTML document (<!DOCTYPE html> through </html>).
- All CSS in one <style> block. Convert Tailwind/Google Fonts to plain CSS. No CDN links, no <script> tags.
- No backdrop-filter. Use box-shadow for depth instead.
- CSS: ${sizeCSS}
- Content MUST fit within the dimensions. Do NOT let text overflow or get cut off.

TEMPLATE (structure reference — bg + header + footer only):
${'```html'}
${templateRef}
${'```'}

TOPIC: ${topic}
CONTEXT: ${snippet}

Return ONLY the complete HTML document. No markdown, no explanation.`;
}

function buildHtmlPrompt(
  topic: string,
  postContent: string,
  templateHtml?: string,
  dimensions?: { width: number; height?: number },
  pageCount: number = 1,
): string {
  // 700 chars — enough context without overloading the prompt (reduces 504 risk)
  const snippet = postContent.slice(0, 700);
  const w = dimensions?.width ?? 1080;
  // height 0 or undefined = auto (null signals auto to prompt builders)
  const h = (dimensions?.height && dimensions.height > 0) ? dimensions.height : null;

  if (templateHtml) {
    return buildTemplatePrompt(topic, snippet, templateHtml, w, h ?? w, pageCount);
  }
  return buildDefaultPrompt(topic, snippet, w, h ?? w, pageCount);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up AI response — strip markdown fences, validate it contains HTML.
 * Returns a single complete HTML document.
 */
function parseHtmlResponse(raw: string): string {
  let text = raw.trim();

  // Strip markdown code blocks  
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
  }

  // Basic sanity check
  if (!text.includes('<!DOCTYPE html') && !text.includes('<html')) {
    throw new Error('[html-gen] AI did not return valid HTML');
  }

  // If the AI generated multiple <!DOCTYPE html> blocks, keep only the first one
  // (We asked for a single document, but the AI might produce extras)
  const parts = text.split(/(?=<!DOCTYPE html)/i).filter(p => p.trim().length > 100);
  if (parts.length > 1) {
    console.warn(`[html-gen] AI returned ${parts.length} HTML documents — using first one only`);
    return parts[0].trim();
  }

  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a self-contained HTML infographic for a topic.
 *
 * @param opts — Generation options including adapter, topic, content, and optional template
 * @returns Complete HTML string ready to store in Firestore
 */
export async function generateHtmlCard(opts: HtmlGenOptions): Promise<string>;
/**
 * @deprecated Use the options-object overload instead.
 */
export async function generateHtmlCard(
  adapter: IAIAdapter,
  topic: string,
  postContent: string,
): Promise<string>;
export async function generateHtmlCard(
  adapterOrOpts: IAIAdapter | HtmlGenOptions,
  topic?: string,
  postContent?: string,
): Promise<string> {
  // Normalise args — support both old 3-arg and new options-object signatures
  let adapter: IAIAdapter;
  let actualTopic: string;
  let actualContent: string;
  let templateHtml: string | undefined;
  let dimensions: { width: number; height?: number } | undefined;
  let pageCount: number = 1;

  if (topic !== undefined && postContent !== undefined) {
    // Old 3-arg call
    adapter = adapterOrOpts as IAIAdapter;
    actualTopic = topic;
    actualContent = postContent;
  } else {
    // New options call
    const opts = adapterOrOpts as HtmlGenOptions;
    adapter = opts.adapter;
    actualTopic = opts.topic;
    actualContent = opts.postContent;
    templateHtml = opts.templateHtml;
    dimensions = opts.dimensions;
    pageCount = opts.pageCount ?? 1;
  }

  const prompt = buildHtmlPrompt(actualTopic, actualContent, templateHtml, dimensions, pageCount);

  // Retry up to 3 times on transient 504 / DEADLINE_EXCEEDED errors
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await adapter.generateText({
        prompt,
        systemInstruction: `You are an HTML generator that creates professional infographic-style HTML documents. Output ONLY a single complete HTML document from <!DOCTYPE html> to </html>. No markdown, no explanation. Content must fit within the specified dimensions — never let text overflow or get cut off.`,
        temperature: 0.5,
        timeoutMs: 120_000, // 2 min — HTML output is large
      });
      return parseHtmlResponse(result.text);
    } catch (err) {
      lastError = err;
      const msg = String(err);
      const isRetryable = msg.includes('504') || msg.includes('DEADLINE_EXCEEDED') || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('500') || msg.includes('INTERNAL');
      if (!isRetryable || attempt === MAX_ATTEMPTS) throw err;
      // Exponential backoff: 3s, 6s
      const delay = attempt * 3_000;
      console.warn(`[html-gen] Gemini ${isRetryable ? '504/503' : 'error'} on attempt ${attempt}/${MAX_ATTEMPTS} — retrying in ${delay / 1000}s…`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

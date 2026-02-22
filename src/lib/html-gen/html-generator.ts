/**
 * HTML Infographic Generator
 *
 * Asks the AI to produce a self-contained HTML infographic for a topic.
 * The HTML is stored in Firestore and rendered in an iframe for preview.
 * At publish time the client converts HTML → PNG via html2canvas.
 *
 * Supports optional template reference: when a template is provided, the AI
 * matches its visual style (colors, fonts, layout patterns, dimensions).
 *
 * KEY RULES FOR THE AI:
 *   - All CSS must be embedded (inline <style>)
 *   - No JavaScript (sandboxed iframe)
 *   - Self-contained: one complete HTML document
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

function buildDefaultPrompt(topic: string, snippet: string, w: number, h: number | null): string {
  const sizeCSS = h
    ? `html, body { margin: 0; padding: 0; width: ${w}px; height: ${h}px; overflow: hidden; }`
    : `html, body { margin: 0; padding: 0; width: ${w}px; overflow: visible; }`;
  const containerRule = h
    ? `Outer container: EXACTLY width:${w}px; height:${h}px; overflow:hidden; margin:0; padding:0 on html and body.`
    : `Outer container: EXACTLY width:${w}px on html and body. Height is AUTO — let the content determine the natural height. Do NOT set a fixed height. Do NOT set overflow:hidden on body.`;

  return `You are a world-class web designer. Generate a single, self-contained HTML infographic that visually explains the given topic.

STRICT REQUIREMENTS:
1. Output a complete HTML document (<!DOCTYPE html> through </html>).
2. ALL styling in a single <style> block inside <head>. NO external stylesheets, NO CDN links, NO <script> tags.
3. CSS MUST BE COMPACT — this is critical to fit within token limits:
   - Use CSS shorthand ALWAYS: margin:0 not margin-top:0; margin-right:0; ...
   - Write one-off styles as style="" on the element instead of a dedicated class.
   - Reuse the same class across multiple elements — never write the same rule twice.
   - Avoid verbose utility class names. Use short names like .hdr, .card, .row.
   - Target 30–50 CSS rules total. NOT 100+.
   - NO browser-reset boilerplate — just box-sizing:border-box and base html/body.
4. The design MUST look stunning:
   - Dark gradient backgrounds (deep navy, charcoal, dark purple)
   - Bold, clean typography with large headings (use system fonts: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)
   - Accent colors (cyan #06b6d4, amber #f59e0b, emerald #10b981, purple #8b5cf6) for highlights
   - Rounded cards with subtle borders and semi-transparent backgrounds (rgba). Do NOT use backdrop-filter or -webkit-backdrop-filter (they break in screenshot tools).
   - Emojis as icons where appropriate
   - Clear visual hierarchy: big title → sections → details
5. ${containerRule}
6. Use flexbox and grid for layout. Modern CSS only.
7. CONTENT QUALITY:
   - Use POST CONTEXT as the primary source for the key points and message of the card.
   - Rephrase into clear, punchy, verifiably-accurate statements.
   - Do NOT introduce unrelated facts. Stay tightly on the topic and the points in the context.
   - Do NOT exaggerate, use misleading oversimplifications, or confuse similar concepts.
   - Every statement should make immediate sense to a senior professional in the field.
   - Code examples MUST use real, recognisable commands (e.g. npx create-next-app@latest). NEVER invent fictional component names or export statements.
   - Any terminal/footer output text should reflect real tool output related to the topic. Do NOT write "Waiting for user to swipe right" or carousel-style text.
8. Keep text SHORT and punchy — this is a visual card, not an article. Max 6-8 short text blocks.
9. IMPORTANT: You MUST output the COMPLETE HTML document. Do NOT stop mid-document. Always close every tag and end with </html>.
10. Add this CSS: ${sizeCSS}
11. DO NOT include any "Swipe Next", "Swipe Right", or carousel navigation text.

LAYOUT (pick the best fit for the topic):
- Split comparison (X vs Y) — two columns with key differences
- Numbered list / tips card — 4-6 concise tips with icons
- Stats dashboard — big numbers with labels
- Code snippet showcase — syntax-highlighted code with explanation
- Flow diagram — step-by-step process with arrows
- Quote + key points — hero quote with supporting bullets

TOPIC: ${topic}

POST CONTEXT (primary content source — use these points, rephrase for clarity and accuracy):
${snippet}

OUTPUT: Return ONLY the complete HTML document. No markdown fencing, no explanation.`;
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
): string {
  // Strip CSS/scripts — keep the full HTML structure so the AI sees every
  // section (title bar, content area, footer, terminal bar, etc.).
  // This is far more reliable than character-count truncation which may cut
  // the template before the footer is reached.
  const templateRef = stripTemplateForReference(templateHtml);

  const sizeCSS = h
    ? `html, body { margin: 0; padding: 0; width: ${w}px; height: ${h}px; overflow: hidden; }`
    : `html, body { margin: 0; padding: 0; width: ${w}px; overflow: visible; }`;
  const containerRule = h
    ? `Outer container: EXACTLY width:${w}px; height:${h}px; overflow:hidden.`
    : `Outer container: EXACTLY width:${w}px. Height is AUTO — let the content determine the natural height. Do NOT set a fixed height. Do NOT set overflow:hidden on body.`;

  return `You are a world-class web designer. Generate a single, self-contained HTML infographic that visually explains the given topic.

MATCH THE TEMPLATE'S VISUAL STYLE AND STRUCTURE:
- Same color palette (use the exact hex colors from the TEMPLATE COLOR PALETTE comment)
- Same font families and font weights
- Same card/panel styling (borders, border-radius, backgrounds)
- Same overall layout approach (grid/flexbox patterns, spacing rhythm)
- Same typography hierarchy and sizing proportions
- REPRODUCE EVERY STRUCTURAL SECTION: if the template has a title bar, content area, AND a footer/terminal bar — your output MUST include all three sections. Missing the footer is a failure.
- DECORATIVE BACKGROUND: copy the exact CSS rules from the DECORATIVE CSS comment (dot-matrix bg, glows, etc.) — these MUST appear in your <style> block.

STRICT REQUIREMENTS:
1. COMPLETE DOCUMENT — #1 rule: You MUST output a complete HTML document from <!DOCTYPE html> to </html>. Always close every open tag. NEVER stop mid-document.
2. ALL styling in a single <style> block inside <head>. NO external stylesheets, NO CDN links, NO <script> tags.
3. Convert any Tailwind classes or Google Fonts references to plain CSS. Zero external dependencies.
4. CSS MUST BE COMPACT — this directly prevents the body content from being cut off:
   - CSS shorthand ALWAYS: margin:0 not margin-top:0; margin-right:0;...
   - Inline style="" for one-off values instead of dedicated classes.
   - Never write the same rule twice — reuse classes.
   - Target 30–45 CSS rules total. Absolutely NOT 100+.
   - No boilerplate resets beyond box-sizing:border-box and base html/body.
   - For decorative effects use the DECORATIVE CSS comment above — copy those rules as-is, do NOT expand or invent more.
5. ${containerRule}
6. Add this CSS: ${sizeCSS}
7. Do NOT use backdrop-filter or -webkit-backdrop-filter (breaks screenshot tools).
8. CONTENT QUALITY — use the POST CONTEXT as your primary content guide:
   - The key points and message come from POST CONTEXT — use them directly.
   - Rephrase into clear, punchy statements. Verify accuracy of any technical claims.
   - Do NOT introduce facts not in the context. Stay tightly on topic.
   - Do NOT exaggerate, use misleading oversimplifications, or confuse similar concepts.
   - Every statement should make immediate sense to a senior professional in the field.
   - Code examples MUST use real, recognisable commands (e.g. npx create-next-app@latest, npm run dev). NEVER invent fictional component names, function names, or export statements (e.g. do NOT write "export default function NextPower()").
   - The terminal/footer bar output text should reflect actual tool output or a shell command related to the topic. Do NOT write "Waiting for user to swipe right" or any carousel text.
9. Keep text SHORT and punchy — visual card, not an article. Max 6-8 short text blocks.
10. DO NOT include any "Swipe Next", "Swipe Right", or carousel navigation text anywhere in the card.

TEMPLATE (CSS/scripts stripped — palette + decorative CSS hints are in comments; reproduce the full HTML structure including every section shown):
${'```html'}
${templateRef}
${'```'}

TOPIC: ${topic}

POST CONTEXT (primary content source — use these points, rephrase for clarity and accuracy):
${snippet}

OUTPUT: Return ONLY the complete HTML document. No markdown fencing, no explanation.`;
}

function buildHtmlPrompt(
  topic: string,
  postContent: string,
  templateHtml?: string,
  dimensions?: { width: number; height?: number },
): string {
  // 600 chars gives enough context for good content without inflating input tokens
  const snippet = postContent.slice(0, 600);
  const w = dimensions?.width ?? 1080;
  // height 0 or undefined = auto (null signals auto to prompt builders)
  const h = (dimensions?.height && dimensions.height > 0) ? dimensions.height : null;

  if (templateHtml) {
    return buildTemplatePrompt(topic, snippet, templateHtml, w, h ?? 1080);
  }
  return buildDefaultPrompt(topic, snippet, w, h ?? 1080);
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
  }

  const prompt = buildHtmlPrompt(actualTopic, actualContent, templateHtml, dimensions);

  const result = await adapter.generateText({
    prompt,
    systemInstruction: 'You are an HTML generator. Output ONLY a complete, valid HTML document. No markdown, no explanation. RULE #1: Always finish the ENTIRE document — the last line MUST be </html>. If you are running low on space, immediately close all open tags and end the document rather than adding more CSS or content. A complete-but-simple card is far better than a beautiful-but-truncated one.',
    temperature: 0.5,
    // No maxTokens cap — let the model use its full native output capacity.
    // The HTML prompt already instructs compact CSS to stay within limits.
    timeoutMs: 120_000, // 2 min — HTML output is large
  });

  return parseHtmlResponse(result.text);
}

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
    : `Outer container: EXACTLY width:${w}px on html and body. Height is AUTO — let content determine natural height. Do NOT set a fixed height or overflow:hidden on body.`;

  return `You are both a world-class web designer AND a deep technical expert on the given topic. Generate a single, self-contained HTML card that explains the topic with expert-level depth and stunning visual design.

CONTENT STANDARD — this is the most important requirement:
- Write like a senior engineer explaining to other senior engineers. Go deep.
- Cover the topic with REAL substance: what it is, why it exists, how it works, key concepts, real-world trade-offs.
- Use MULTIPLE content sections (3-5), each with a clear heading, 2-4 sentences of explanation, and supporting detail (lists, code, comparisons).
- Include at least ONE real, runnable code or command example with syntax highlighting using colored spans.
- Every claim must be accurate and specific. No vague filler. No oversimplifications.
- Do NOT write carousel-style bullet fragments like "Fast performance" — write actual explanations.
- Code examples MUST use real commands/APIs (e.g. npx create-next-app@latest). Never invent fictional names.

DESIGN REQUIREMENTS:
1. Complete HTML document (<!DOCTYPE html> through </html>). NEVER stop mid-document.
2. ALL styling in a single <style> block. NO external CSS, NO CDN links, NO <script> tags.
3. CSS shorthand ALWAYS. Inline style="" for one-off values. Reuse classes. No boilerplate resets beyond box-sizing:border-box.
4. Design MUST be stunning — dark theme:
   - Background: #0d1117 with a dot-matrix pattern: background-image:radial-gradient(circle,#30363d 2px,transparent 2px); background-size:32px 32px;
   - Header bar (macOS-style title bar): bg #161b22, three colored dots (red #ff5f56, yellow #ffbd2e, green #27c93f), monospace filename in center.
   - Content area: cards with bg #161b22, border 1px solid #30363d, border-radius 12px.
   - Footer/terminal bar: bg #0a0d12, border-top #30363d, monospace terminal prompt + real relevant command output.
   - Fonts: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif for body; monospace for code.
   - Accent colors: #79c0ff (cyan), #7ee787 (green), #ff7b72 (pink/red), #F7DF1E (yellow), #8b949e (comment gray).
   - Rounded cards, subtle glows (box-shadow with rgba), no backdrop-filter.
5. ${containerRule}
6. ${sizeCSS}
7. STRUCTURE (use this layout):
   - Title bar at top (macOS dots + filename)
   - Scrollable/full content area with 3-5 sections
   - Terminal footer at bottom
8. DO NOT include any carousel text ("Swipe Next", "Swipe Right", etc.).
9. The terminal footer line MUST show a real, relevant shell command for this topic — not "swipe right".

TOPIC: ${topic}

POST CONTEXT (use as your content foundation — expand on these points with expert depth):
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

  return `You are both a world-class web designer AND a deep technical expert on the given topic. Generate a single, self-contained HTML card that explains the topic with expert-level depth.

TEMPLATE STRUCTURE RULES (non-negotiable):
- The BACKGROUND must match: use the exact background-color and decorative CSS from the DECORATIVE CSS hint.
- The HEADER/TITLE BAR must match: reproduce the same macOS-style title bar (three colored dots, monospace filename in center) from the template structure.
- The FOOTER/TERMINAL BAR must match: reproduce the same terminal bar at the bottom with the same styling from the template structure.
- The main CONTENT AREA between header and footer: you are FREE to design this however you want. Do not copy the template content layout — make something great.
- Use the exact hex colors from TEMPLATE COLOR PALETTE for all backgrounds, borders, text, and accents.

CONTENT STANDARD — write with expert depth:
- Write like a senior engineer explaining to other senior engineers. Go deep.
- Cover the topic with REAL substance: what it is, why it exists, how it works, key concepts, real-world trade-offs.
- Use MULTIPLE content sections (3-5), each with a clear heading, 2-4 sentences of explanation, and supporting detail.
- Include at least ONE real, runnable code or command example with syntax highlighting using colored spans.
- Every claim must be accurate and specific. No vague filler. No oversimplifications.
- Code examples MUST use real commands/APIs. NEVER invent fictional component names or function names.
- The terminal footer line MUST show a real, relevant shell command for the topic. Do NOT write "swipe right" or carousel text.

STRICT TECHNICAL REQUIREMENTS:
1. COMPLETE DOCUMENT — You MUST output a complete HTML document from <!DOCTYPE html> to </html>. NEVER stop mid-document.
2. ALL styling in a single <style> block inside <head>. NO external stylesheets, NO CDN links, NO <script> tags.
3. Convert any Tailwind classes or Google Fonts from the template to plain CSS. Zero external dependencies.
4. CSS MUST BE COMPACT:
   - CSS shorthand ALWAYS. Inline style="" for one-off values. Never repeat a rule.
   - For decorative effects use the DECORATIVE CSS comment above — copy those rules as-is.
   - Do NOT use backdrop-filter or -webkit-backdrop-filter (breaks screenshot tools).
5. ${containerRule}
6. Add this CSS: ${sizeCSS}
7. DO NOT include any "Swipe Next", "Swipe Right", or carousel navigation text.

TEMPLATE (CSS/scripts stripped — copy the bg, header, and footer structure exactly; design the content area freely):
${'```html'}
${templateRef}
${'```'}

TOPIC: ${topic}

POST CONTEXT (use as your content foundation — expand on these points with expert depth):
${snippet}

OUTPUT: Return ONLY the complete HTML document. No markdown fencing, no explanation.`;
}

function buildHtmlPrompt(
  topic: string,
  postContent: string,
  templateHtml?: string,
  dimensions?: { width: number; height?: number },
): string {
  // 1200 chars — enough context for the AI to write expert-level detailed sections
  const snippet = postContent.slice(0, 1200);
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

/**
 * HTML Generation — Shared Utilities
 *
 * These are lightweight helpers safe to import from both client and server code.
 * No 'server-only' import here.
 */

/** @deprecated Legacy delimiter — no longer used for new posts */
export const PAGE_BREAK = '<!-- PAGE_BREAK -->';

/** @deprecated Legacy helper — kept for backward compat with old posts that used PAGE_BREAK */
export function splitHtmlPages(htmlContent: string): string[] {
  const pages = htmlContent.split(PAGE_BREAK).map(p => p.trim()).filter(Boolean);
  return pages.length > 0 ? pages : [htmlContent];
}

/** @deprecated Legacy helper — kept for backward compat */
export function joinHtmlPages(pages: string[]): string {
  return pages.join(`\n${PAGE_BREAK}\n`);
}

/**
 * Calculate the page height for carousel slicing.
 * Returns the height of one "page" (slide) in pixels.
 * Default: pageHeight = width (square slides).
 */
export function getPageHeight(html: string): number {
  const wMatch = html.match(/(?:html|body)\s*[^}]*?width\s*:\s*(\d+)px/);
  const width = wMatch ? parseInt(wMatch[1], 10) : 1080;
  // Check if the doc has an explicit non-multipage height set
  // For multi-page docs the total height = width * pageCount, so page height = width
  return width;
}

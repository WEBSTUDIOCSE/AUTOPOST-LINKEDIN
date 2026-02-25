/**
 * HTML Generation — Shared Utilities
 *
 * These are lightweight helpers safe to import from both client and server code.
 * No 'server-only' import here.
 */

/** Delimiter used to separate carousel pages stored as a single string. */
export const PAGE_BREAK = '<!-- PAGE_BREAK -->';

/** Split a PAGE_BREAK-joined string back into individual HTML pages. */
export function splitHtmlPages(htmlContent: string): string[] {
  const pages = htmlContent.split(PAGE_BREAK).map(p => p.trim()).filter(Boolean);
  return pages.length > 0 ? pages : [htmlContent];
}

/** Join an array of HTML page strings with the PAGE_BREAK delimiter. */
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

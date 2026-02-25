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

/**
 * Remove a specific slide (by 0-based index) from a multi-page HTML document.
 *
 * The document is structured as a tall page (height = width × pageCount).
 * Each slide occupies a `width × width` section. This function:
 *   1. Parses the HTML into a DOM
 *   2. Finds the top-level section/div children of the body that correspond
 *      to each slide (by their position in document flow)
 *   3. Removes the target one
 *   4. Updates the CSS height to reflect the new page count
 *
 * Returns { html, newPageCount } or null if the slide can't be removed
 * (e.g., only 1 slide remaining).
 */
export function removeSlideFromHtml(
  html: string,
  slideIndex: number,
  currentPageCount: number,
): { html: string; newPageCount: number } | null {
  if (currentPageCount <= 1 || slideIndex < 0 || slideIndex >= currentPageCount) return null;

  const wMatch = html.match(/(?:html|body)\s*[^}]*?width\s*:\s*(\d+)px/);
  const width = wMatch ? parseInt(wMatch[1], 10) : 1080;
  const oldTotalH = width * currentPageCount;
  const newPageCount = currentPageCount - 1;
  const newTotalH = width * newPageCount;

  // Use DOMParser if available (browser), otherwise do regex-based removal
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find top-level slide containers — look for direct children of body
    // that represent slides (divs/sections with the slide height)
    const body = doc.body;
    const slideElements = Array.from(body.children).filter(
      el => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT'
    );

    if (slideElements.length >= currentPageCount && slideIndex < slideElements.length) {
      slideElements[slideIndex].remove();
    } else {
      // Fallback: can't reliably identify slides in DOM
      return null;
    }

    // Update CSS height
    let result = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
    result = result.replace(
      new RegExp(`height\\s*:\\s*${oldTotalH}px`, 'g'),
      `height:${newTotalH}px`,
    );
    return { html: result, newPageCount };
  }

  // Server-side regex fallback: update height only (can't reliably remove DOM nodes)
  // This path is used if called from Node without JSDOM
  let result = html.replace(
    new RegExp(`height\\s*:\\s*${oldTotalH}px`, 'g'),
    `height:${newTotalH}px`,
  );
  // Try to remove the nth top-level section/div
  const sectionPattern = /(<(?:div|section)\b[^>]*>[\s\S]*?<\/(?:div|section)>)/gi;
  const sections: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  let depth = 0;
  // Simple: find top-level slide wrappers by scanning for matching tags
  const bodyMatch = result.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1];
    const bodyStart = result.indexOf(bodyMatch[1]);
    // Find top-level divs/sections in body
    const tagRe = /<(\/?)(?:div|section)\b[^>]*>/gi;
    let startPos = -1;
    depth = 0;
    while ((m = tagRe.exec(bodyContent)) !== null) {
      if (m[1] === '') {
        // Opening tag
        if (depth === 0) startPos = m.index;
        depth++;
      } else {
        // Closing tag
        depth--;
        if (depth === 0 && startPos >= 0) {
          sections.push({ start: bodyStart + startPos, end: bodyStart + m.index + m[0].length });
          startPos = -1;
        }
      }
    }
  }

  if (sections.length >= currentPageCount && slideIndex < sections.length) {
    const { start, end } = sections[slideIndex];
    result = result.slice(0, start) + result.slice(end);
    return { html: result, newPageCount };
  }

  return null;
}

/**
 * Print page boxes. Preset sizes print through named `@page` rules in
 * `paged.css` (`tx-pages-a4-portrait`, …); a custom size gets its own
 * `@page tx-pages-custom` rule in a constructed stylesheet (no style
 * element, no markup: CSSOM only, so a strict `style-src` still allows it).
 */
import type { PageGeometry } from '@texuli/document/paged';

/** The named page a paged view prints on. */
export function pageName(geometry: Pick<PageGeometry, 'size' | 'orientation'>): string {
  return geometry.size === 'custom'
    ? 'tx-pages-custom'
    : `tx-pages-${geometry.size}-${geometry.orientation}`;
}

/** The `@page` rule of a custom size, from finite millimetres only. */
export function customPageRule(widthMm: number, heightMm: number): string | null {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return null;
  }
  return `@page tx-pages-custom { size: ${widthMm.toFixed(3)}mm ${heightMm.toFixed(3)}mm; margin: 0; }`;
}

/** Adopt the custom page rule into a document; returns the cleanup. A no-op without constructable stylesheets. */
export function adoptCustomPage(owner: Document, widthMm: number, heightMm: number): () => void {
  const rule = customPageRule(widthMm, heightMm);
  const view = owner.defaultView as (Window & { CSSStyleSheet?: typeof CSSStyleSheet }) | null;
  if (!rule || !view?.CSSStyleSheet || !('adoptedStyleSheets' in owner)) return () => {};
  let sheet: CSSStyleSheet;
  try {
    sheet = new view.CSSStyleSheet();
    sheet.replaceSync(rule);
  } catch {
    return () => {};
  }
  owner.adoptedStyleSheets = [...owner.adoptedStyleSheets, sheet];
  return () => {
    owner.adoptedStyleSheets = owner.adoptedStyleSheets.filter((item) => item !== sheet);
  };
}

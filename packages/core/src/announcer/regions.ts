/**
 * Visually hidden live-region nodes. Styles use logical properties and keep
 * the node in the accessibility tree (no `display: none` / `visibility: hidden`
 * / `aria-hidden`).
 */

export const ANNOUNCER_REGION_ATTR = 'data-texuli-announcer' as const;

const HIDDEN_STYLE = [
  'position: absolute',
  'inline-size: 1px',
  'block-size: 1px',
  'margin: -1px',
  'padding: 0',
  'border: 0',
  'overflow: hidden',
  'clip: rect(0, 0, 0, 0)',
  'white-space: nowrap',
].join(';');

export type RegionKind = 'polite' | 'assertive';

export function createLiveRegion(documentRef: Document, kind: RegionKind): HTMLElement {
  const node = documentRef.createElement('div');
  node.setAttribute(ANNOUNCER_REGION_ATTR, kind);
  node.setAttribute('aria-live', kind);
  node.setAttribute('aria-atomic', 'true');
  if (kind === 'assertive') {
    node.setAttribute('role', 'alert');
  } else {
    node.setAttribute('role', 'status');
  }
  // Presentational hide; keep in a11y tree. CSSOM, not a `style` attribute,
  // which a strict CSP (`style-src` without 'unsafe-inline') blocks.
  node.style.cssText = HIDDEN_STYLE;
  node.textContent = '';
  return node;
}

export function appendRegion(node: HTMLElement, parent: Element): void {
  if (node.parentNode === parent) return;
  parent.appendChild(node);
}

export function resolveAppendTarget(documentRef: Document, appendTo?: Element): Element {
  if (appendTo) return appendTo;
  if (documentRef.body) return documentRef.body;
  return documentRef.documentElement;
}

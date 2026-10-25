import type { TabbableOptions } from './options.ts';

/**
 * Owned tabbable / focusable query (no third-party `tabbable`).
 *
 * - **Focusable:** can receive programmatic focus (`element.focus()`).
 * - **Tabbable:** focusable and in sequential Tab order (`tabIndex >= 0` or
 *   natively tabbable without `tabindex="-1"`).
 *
 * Respects `disabled` (including disabled `fieldset`, with the first-legend
 * exception), `hidden`, computed `display`/`visibility`, the `inert`
 * attribute/property on ancestors, `aria-hidden="true"` on ancestors, closed
 * `<details>` (only the summary stays reachable), open shadow roots, and
 * `contenteditable`. Radio groups contribute at most one tab stop.
 *
 * Framework-free. Callers pass the element or document; nothing touches
 * `window`/`document` at module load.
 */

const CANDIDATE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'button',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[tabindex]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',');

function resolveDocument(root: Element | Document, options?: TabbableOptions): Document {
  if (options?.document) return options.document;
  if (root.nodeType === 9) return root as Document;
  return (root as Element).ownerDocument;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function parseTabIndex(element: Element): number | null {
  if (!element.hasAttribute('tabindex') && !element.hasAttribute('tabIndex')) {
    return null;
  }
  const raw = element.getAttribute('tabindex') ?? element.getAttribute('tabIndex');
  if (raw === null || raw.trim() === '') return 0;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : 0;
}

function isContentEditable(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  const value = element.getAttribute('contenteditable');
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'true' || normalized === 'plaintext-only';
}

function isNativelyFocusableTag(element: Element): boolean {
  const tag = element.tagName;
  switch (tag) {
    case 'A':
    case 'AREA':
      return element.hasAttribute('href');
    case 'INPUT':
      return (element as HTMLInputElement).type !== 'hidden';
    case 'SELECT':
    case 'TEXTAREA':
    case 'BUTTON':
    case 'IFRAME':
    case 'OBJECT':
    case 'EMBED':
      return true;
    case 'AUDIO':
    case 'VIDEO':
      return element.hasAttribute('controls');
    case 'SUMMARY':
      return true;
    default:
      return false;
  }
}

function isDisabledFormControl(element: Element): boolean {
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    return element.disabled;
  }
  if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    return element.disabled;
  }
  if (element instanceof HTMLOptionElement || element instanceof HTMLOptGroupElement) {
    return element.disabled;
  }
  if (element instanceof HTMLFieldSetElement) {
    return element.disabled;
  }
  return element.hasAttribute('disabled');
}

/**
 * A control under a disabled fieldset is disabled unless it sits in the
 * fieldset's first legend (HTML disabled-fieldset rule).
 */
function isDisabledByFieldset(element: Element): boolean {
  let node: Element | null = element.parentElement;
  while (node) {
    if (node instanceof HTMLFieldSetElement && node.disabled) {
      const legend = firstLegend(node);
      if (legend && (element === legend || legend.contains(element))) {
        node = node.parentElement;
        continue;
      }
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function firstLegend(fieldset: HTMLFieldSetElement): HTMLLegendElement | null {
  for (const child of fieldset.children) {
    if (child instanceof HTMLLegendElement) return child;
  }
  return null;
}

function isInert(element: Element): boolean {
  let node: Element | null = element;
  while (node) {
    if (node instanceof HTMLElement && node.inert) return true;
    if (node.hasAttribute('inert')) return true;
    node = node.parentElement;
  }
  return false;
}

function isAriaHidden(element: Element): boolean {
  let node: Element | null = element;
  while (node) {
    if (node.getAttribute('aria-hidden') === 'true') return true;
    node = node.parentElement;
  }
  return false;
}

function isHiddenAttribute(element: Element): boolean {
  let node: Element | null = element;
  while (node) {
    if (node.hasAttribute('hidden')) return true;
    node = node.parentElement;
  }
  return false;
}

function isClosedDetailsContent(element: Element): boolean {
  let node: Element | null = element;
  while (node) {
    const parent: Element | null = node.parentElement;
    if (parent instanceof HTMLDetailsElement && !parent.open) {
      const summary = firstSummary(parent);
      if (!(summary && (element === summary || summary.contains(element)))) {
        return true;
      }
    }
    node = parent;
  }
  return false;
}

function firstSummary(details: HTMLDetailsElement): Element | null {
  for (const child of details.children) {
    // happy-dom may not define HTMLSummaryElement; tag name is enough.
    if (child.tagName === 'SUMMARY') return child;
  }
  return null;
}

function isVisuallyHidden(element: Element, doc: Document): boolean {
  const view = doc.defaultView;
  if (!view) return false;
  let node: Element | null = element;
  while (node && node.nodeType === 1) {
    const style = view.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return true;
    node = node.parentElement;
  }
  return false;
}

function isAreaInVisibleMap(element: Element, doc: Document): boolean {
  if (!(element instanceof HTMLAreaElement) || !element.href) return false;
  const map = element.closest('map');
  if (!(map instanceof HTMLMapElement) || !map.name) return false;
  const img = doc.querySelector(`img[usemap="#${cssEscape(map.name)}"]`);
  if (!(img instanceof HTMLImageElement)) return false;
  return !isVisuallyHidden(img, doc) && !isHiddenAttribute(img) && !isAriaHidden(img);
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

/**
 * True when `element` can receive programmatic focus under the rules above.
 */
export function isFocusable(element: Element, options?: TabbableOptions): boolean {
  if (!isElement(element)) return false;
  const doc = resolveDocument(element, options);
  const tabIndex = parseTabIndex(element);

  const candidate =
    tabIndex !== null || isNativelyFocusableTag(element) || isContentEditable(element);
  if (!candidate) return false;

  if (element instanceof HTMLAreaElement) {
    if (!isAreaInVisibleMap(element, doc)) return false;
  }

  if (isDisabledFormControl(element) || isDisabledByFieldset(element)) return false;
  if (isInert(element)) return false;
  if (isAriaHidden(element)) return false;
  if (isHiddenAttribute(element)) return false;
  if (isClosedDetailsContent(element)) return false;
  if (isVisuallyHidden(element, doc)) return false;

  // tabindex="-0" etc. still focusable; any parsed index is fine for focus.
  return true;
}

/**
 * True when `element` is focusable and participates in sequential Tab order.
 */
export function isTabbable(element: Element, options?: TabbableOptions): boolean {
  if (!isFocusable(element, options)) return false;
  const tabIndex = parseTabIndex(element);
  if (tabIndex !== null && tabIndex < 0) return false;
  if (!isRadioTabStop(element)) return false;
  return true;
}

/**
 * In a named radio group, only the checked radio (or the first enabled one
 * when none is checked) is a tab stop.
 */
function radioScope(element: HTMLInputElement): ParentNode {
  if (element.form) return element.form;
  const root = element.getRootNode();
  if (root instanceof Document || root instanceof ShadowRoot) return root;
  return element.ownerDocument;
}

function isRadioTabStop(element: Element): boolean {
  if (!(element instanceof HTMLInputElement) || element.type !== 'radio') return true;
  if (!element.name) return true;
  const root = radioScope(element);
  const group = root.querySelectorAll('input[type="radio"]');
  const named: HTMLInputElement[] = [];
  for (const node of group) {
    if (!(node instanceof HTMLInputElement)) continue;
    if (node.name !== element.name) continue;
    if (node.disabled) continue;
    // Same radio tree scope (shadow / document).
    if (node.getRootNode() !== element.getRootNode()) continue;
    if (node.form !== element.form) continue;
    named.push(node);
  }
  if (named.length === 0) return true;
  const checked = named.find((radio) => radio.checked);
  if (checked) return checked === element;
  return named[0] === element;
}

/**
 * Collect candidate elements under `root`. When `includeRoot` is false (the
 * usual case for a container passed to get*Elements), the root itself is not
 * added even if it matches the selector.
 */
function collectCandidates(root: ParentNode, out: Element[], includeRoot: boolean): void {
  if (includeRoot && isElement(root) && root.matches(CANDIDATE_SELECTOR)) {
    out.push(root);
  }
  const list = root.querySelectorAll(CANDIDATE_SELECTOR);
  for (const el of list) out.push(el);

  const all = root.querySelectorAll('*');
  for (const el of all) {
    if (el.shadowRoot) collectCandidates(el.shadowRoot, out, true);
  }
  if (isElement(root) && root.shadowRoot) {
    collectCandidates(root.shadowRoot, out, true);
  }
}

function uniqueInTreeOrder(elements: Element[]): Element[] {
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const el of elements) {
    if (seen.has(el)) continue;
    seen.add(el);
    result.push(el);
  }
  return result;
}

function documentPosition(a: Element, b: Element): number {
  if (a === b) return 0;
  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  // Disconnected or different trees: keep stable input order.
  return 0;
}

function sortTabbable(elements: Element[]): Element[] {
  const withIndex = elements.map((el, order) => ({
    el,
    order,
    tabIndex: parseTabIndex(el) ?? 0,
  }));
  withIndex.sort((a, b) => {
    const aPositive = a.tabIndex > 0;
    const bPositive = b.tabIndex > 0;
    if (aPositive && bPositive) {
      if (a.tabIndex !== b.tabIndex) return a.tabIndex - b.tabIndex;
      return documentPosition(a.el, b.el) || a.order - b.order;
    }
    if (aPositive) return -1;
    if (bPositive) return 1;
    return documentPosition(a.el, b.el) || a.order - b.order;
  });
  return withIndex.map((row) => row.el);
}

function scopeRoot(root: Element | Document): ParentNode {
  if (root.nodeType === 9) {
    return (root as Document).body ?? root;
  }
  return root;
}

/**
 * Focusable elements under `root`, in tree order (not Tab order).
 */
export function getFocusableElements(
  root: Element | Document,
  options?: TabbableOptions
): HTMLElement[] {
  const candidates: Element[] = [];
  const scope = scopeRoot(root);
  const includeRoot = Boolean(options?.includeContainer) && isElement(root) && scope === root;
  collectCandidates(scope, candidates, includeRoot);
  return uniqueInTreeOrder(candidates).filter((el) => isFocusable(el, options)) as HTMLElement[];
}

/**
 * Tabbable elements under `root` in sequential focus navigation order:
 * positive `tabindex` ascending, then the rest in tree order.
 */
export function getTabbableElements(
  root: Element | Document,
  options?: TabbableOptions
): HTMLElement[] {
  const focusable = getFocusableElements(root, options);
  const tabbable = focusable.filter((el) => isTabbable(el, options));
  return sortTabbable(tabbable) as HTMLElement[];
}

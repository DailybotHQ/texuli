/**
 * Maps a painted tree onto catalog roots (ADR-032): every interactive
 * element must sit inside `[data-tx-component]`, and once `allow` exists
 * every such root must be listed. Pure over a DOM parent; no browser APIs
 * beyond `querySelectorAll` / `closest`. Checkers pass the compiled allow
 * manifest; the catalog is never imported.
 */
import type { DsCheckIssue } from './types.ts';

/** Same name as `DS_COMPONENT_ATTRIBUTE` (`@texuli/spec/design-system`). */
const COMPONENT_ATTRIBUTE = 'data-tx-component';

/** Interactive element with no catalog root as its closest ancestor. */
export const DS_MAP_UNMAPPED = 'unmapped';
/** Catalog root whose id is not in `allow` (only when `allow` exists). */
export const DS_MAP_NOT_ALLOWED = 'not-allowed';
export const DS_MAP_CODES = [DS_MAP_NOT_ALLOWED, DS_MAP_UNMAPPED] as const;

/** Cap matches `DESIGN_SYSTEM_LIMITS.errors`. */
export const DS_MAP_MAX_ISSUES = 64;

const INTERACTIVE = [
  'a[href]',
  'area[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="searchbox"]',
  '[role="textbox"]',
  '[role="treeitem"]',
].join(',');

export interface DsMapAllowManifest {
  readonly allow?: Readonly<Record<string, unknown>>;
}

export interface DsMapOptions {
  /**
   * Compiled allow manifest (or a stub with `allow`). Omitted `allow` means
   * the document is not locked: only unmapped interactive elements fail.
   */
  allowManifest?: DsMapAllowManifest;
}

export interface DsMapReport {
  ok: boolean;
  /** Distinct issue codes, sorted. */
  codes: string[];
  errors: DsCheckIssue[];
}

const ROOT_SELECTOR = `[${COMPONENT_ATTRIBUTE}]`;

function allowedIds(manifest: DsMapAllowManifest | undefined): Set<string> | undefined {
  if (!manifest || manifest.allow === undefined) return undefined;
  return new Set(Object.keys(manifest.allow));
}

function attrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function step(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id && /^[A-Za-z_][\w-]*$/.test(el.id)) return `${tag}#${el.id}`;
  const id = el.getAttribute(COMPONENT_ATTRIBUTE);
  const attr = id ? `[${COMPONENT_ATTRIBUTE}="${attrValue(id)}"]` : '';
  const parent = el.parentElement;
  if (!parent) return `${tag}${attr}`;
  const same = [...parent.children].filter((child) => child.tagName === el.tagName);
  const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : '';
  return `${tag}${attr}${nth}`;
}

const ELEMENT_NODE = 1;

function isElement(node: ParentNode): node is Element {
  return node.nodeType === ELEMENT_NODE;
}

/** A selector of `el` that `scope.querySelector` can resolve. */
export function dsMapSelector(el: Element, scope: ParentNode): string {
  const parts: string[] = [];
  let node: Element | null = el;
  const stop = isElement(scope) ? scope : null;
  while (node && node !== stop) {
    parts.unshift(step(node));
    if (node.id && /^[A-Za-z_][\w-]*$/.test(node.id)) break;
    node = node.parentElement;
  }
  return parts.join('>');
}

function describe(el: Element): string {
  const classes = [...el.classList].filter((name) => !name.startsWith('svelte-')).slice(0, 2);
  const role = el.getAttribute('role');
  return `${el.tagName.toLowerCase()}${classes.length ? `.${classes.join('.')}` : ''}${role ? `[role=${role}]` : ''}`;
}

function push(
  errors: DsCheckIssue[],
  code: (typeof DS_MAP_CODES)[number],
  el: Element,
  scope: ParentNode,
  message: string,
  component?: string
): void {
  if (errors.length >= DS_MAP_MAX_ISSUES) return;
  errors.push({
    code,
    path: dsMapSelector(el, scope),
    message,
    ...(component ? { source: component } : {}),
    hint: describe(el),
  });
}

/**
 * List interactive elements that sit outside an allowed catalog root, and
 * catalog roots the allow manifest does not list. Stable codes: `unmapped`,
 * `not-allowed`.
 */
export function mapDesignSystemTree(root: ParentNode, options: DsMapOptions = {}): DsMapReport {
  const errors: DsCheckIssue[] = [];
  const allowed = allowedIds(options.allowManifest);
  const seen = new Set<Element>();

  if (allowed) {
    for (const el of root.querySelectorAll(ROOT_SELECTOR)) {
      const id = el.getAttribute(COMPONENT_ATTRIBUTE) ?? '';
      if (allowed.has(id)) continue;
      push(
        errors,
        DS_MAP_NOT_ALLOWED,
        el,
        root,
        id
          ? `Component "${id}" is not in the allow manifest.`
          : 'Component root has an empty data-tx-component.',
        id || undefined
      );
    }
  }

  for (const el of root.querySelectorAll(INTERACTIVE)) {
    if (seen.has(el) || errors.length >= DS_MAP_MAX_ISSUES) continue;
    seen.add(el);
    const owner = el.closest(ROOT_SELECTOR);
    if (!owner) {
      push(
        errors,
        DS_MAP_UNMAPPED,
        el,
        root,
        'Interactive element is not inside a catalog component root.'
      );
      continue;
    }
    if (!allowed) continue;
    const id = owner.getAttribute(COMPONENT_ATTRIBUTE) ?? '';
    if (allowed.has(id)) continue;
    // The root is already a `not-allowed` finding; do not also flag every
    // inner control as unmapped.
  }

  errors.sort((a, b) => a.code.localeCompare(b.code) || a.path.localeCompare(b.path));
  const codes = [...new Set(errors.map((issue) => issue.code))].sort();
  return { ok: errors.length === 0, codes, errors };
}

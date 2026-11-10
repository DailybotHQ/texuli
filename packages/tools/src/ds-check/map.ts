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
/** A rendered `data-tx-variant` / size / tone / density / color the allow entry disables. */
export const DS_MAP_DISABLED_VALUE = 'render-disabled-value';
export const DS_MAP_CODES = [DS_MAP_DISABLED_VALUE, DS_MAP_NOT_ALLOWED, DS_MAP_UNMAPPED] as const;

/**
 * Compound catalog parents whose `id-part` roots (select-trigger, …) resolve
 * to the parent when that parent is allowed. Independent ids such as
 * `button-group` are not in this list.
 */
export const DS_MAP_COMPOUND_PARENTS = [
  'accordion',
  'alert-dialog',
  'combobox',
  'command',
  'context-menu',
  'dialog',
  'dropdown-menu',
  'hover-card',
  'menubar',
  'multi-select',
  'navigation-menu',
  'popover',
  'select',
  'tabs',
] as const;

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
  /** Extra child → parent catalog ids (library `composes`, host extensions). */
  composed?: Readonly<Record<string, string>>;
}

export interface DsMapReport {
  ok: boolean;
  /** Distinct issue codes, sorted. */
  codes: string[];
  errors: DsCheckIssue[];
}

const ROOT_SELECTOR = `[${COMPONENT_ATTRIBUTE}]`;

const AXIS_ATTRS = [
  ['variant', 'data-tx-variant', 'variants'],
  ['size', 'data-tx-size', 'sizes'],
  ['tone', 'data-tx-tone', 'tones'],
  ['density', 'data-tx-density', 'densities'],
  ['color', 'data-tx-color', 'colors'],
] as const;

const COMPOUND = new Set<string>(DS_MAP_COMPOUND_PARENTS);

function allowedIds(manifest: DsMapAllowManifest | undefined): Set<string> | undefined {
  if (!manifest || manifest.allow === undefined) return undefined;
  return new Set(Object.keys(manifest.allow));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The allow key that covers `id`: itself, a compound parent (`select-trigger` →
 * `select`), an extension local id (`acme:select-trigger` → `acme:select` or
 * `select`), a composed parent, or a DOM ancestor catalog root.
 */
export function resolveAllowedComponentId(
  id: string,
  allowed: ReadonlySet<string>,
  options: { composed?: Readonly<Record<string, string>>; ancestor?: string } = {}
): string | undefined {
  if (!id) return undefined;
  if (allowed.has(id)) return id;
  const composed = options.composed?.[id];
  if (composed && allowed.has(composed)) return composed;
  if (options.ancestor && allowed.has(options.ancestor)) return options.ancestor;
  const colon = id.lastIndexOf(':');
  if (colon > 0) {
    const ns = id.slice(0, colon);
    const local = id.slice(colon + 1);
    const inner = resolveAllowedComponentId(local, allowed, {
      composed: options.composed,
      ancestor: options.ancestor?.includes(':')
        ? options.ancestor.slice(options.ancestor.lastIndexOf(':') + 1)
        : options.ancestor,
    });
    if (inner) {
      if (allowed.has(`${ns}:${inner}`)) return `${ns}:${inner}`;
      if (allowed.has(inner)) return inner;
    }
  }
  let best: string | undefined;
  for (const parent of allowed) {
    const localParent = parent.includes(':') ? parent.slice(parent.lastIndexOf(':') + 1) : parent;
    if (!COMPOUND.has(localParent)) continue;
    if (id.startsWith(`${parent}-`) || id.startsWith(`${localParent}-`)) {
      if (!best || parent.length > best.length) best = parent;
    }
  }
  return best;
}

function ancestorCatalogId(el: Element): string | undefined {
  const owner = el.parentElement?.closest(ROOT_SELECTOR);
  const id = owner?.getAttribute(COMPONENT_ATTRIBUTE);
  return id || undefined;
}

function allowAxisValues(entry: unknown, field: string): readonly string[] | undefined {
  if (!isRecord(entry)) return undefined;
  const listed = entry[field];
  if (listed === undefined) return undefined;
  if (!Array.isArray(listed)) return [];
  return listed.filter((item): item is string => typeof item === 'string');
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
      const covered = resolveAllowedComponentId(id, allowed, {
        composed: options.composed,
        ancestor: ancestorCatalogId(el),
      });
      if (!covered) {
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
        continue;
      }
      const entry = options.allowManifest?.allow?.[covered];
      for (const [axis, attr, field] of AXIS_ATTRS) {
        const painted = el.getAttribute(attr);
        if (!painted) continue;
        const listed = allowAxisValues(entry, field);
        if (listed === undefined) continue;
        if (listed.includes(painted)) continue;
        push(
          errors,
          DS_MAP_DISABLED_VALUE,
          el,
          root,
          `Rendered ${axis} "${painted}" is not allowed for "${covered}".`,
          covered
        );
      }
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
    if (
      resolveAllowedComponentId(id, allowed, {
        composed: options.composed,
        ancestor: ancestorCatalogId(owner),
      })
    )
      continue;
    // The root is already a `not-allowed` finding; do not also flag every
    // inner control as unmapped.
  }

  errors.sort((a, b) => a.code.localeCompare(b.code) || a.path.localeCompare(b.path));
  const codes = [...new Set(errors.map((issue) => issue.code))].sort();
  return { ok: errors.length === 0, codes, errors };
}

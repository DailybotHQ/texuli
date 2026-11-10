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
 * Declared catalog part → parent ids (0.17.2): the same relation as `CATALOG_PART_PARENTS` in
 * `@texuli/catalog/manifest` (a part ships in its parent's public module, the data the static
 * locked check reads), kept here so the browser host imports no catalog. A shared hyphen
 * prefix is not a relation: `alert-dialog`, `icon-button`, `avatar-group-grid`,
 * `text-counter`, `code-field`, `form-field` and `form-submit` are their own ids.
 */
export const DS_MAP_PART_PARENTS: Readonly<Record<string, string>> = Object.freeze({
  'button-group': 'button',
  'context-menu-trigger': 'context-menu',
  'data-dashboard-widget': 'data-dashboard',
  'dropdown-menu-content': 'dropdown-menu',
  'dropdown-menu-item': 'dropdown-menu',
  'dropdown-menu-trigger': 'dropdown-menu',
  'field-error': 'field',
  'hover-card-content': 'hover-card',
  'input-group': 'input',
  'list-item': 'list',
  'menubar-trigger': 'menubar',
  'popover-content': 'popover',
  'radio-group': 'radio',
  'select-content': 'select',
  'select-group': 'select',
  'select-item': 'select',
  'select-label': 'select',
  'select-portal': 'select',
  'select-separator': 'select',
  'select-trigger': 'select',
  'select-value': 'select',
  'select-viewport': 'select',
});

/** Catalog parents that own declared parts (the values of {@link DS_MAP_PART_PARENTS}). */
export const DS_MAP_COMPOUND_PARENTS = [
  'button',
  'context-menu',
  'data-dashboard',
  'dropdown-menu',
  'field',
  'hover-card',
  'input',
  'list',
  'menubar',
  'popover',
  'radio',
  'select',
] as const;

/**
 * The declared parent of a catalog part (`select-trigger` → `select`), also across an
 * extension namespace (`acme:select-trigger` → `acme:select`); `undefined` for any other id.
 */
export function dsCatalogPartParent(id: string): string | undefined {
  const colon = id.lastIndexOf(':');
  const local = colon > 0 ? id.slice(colon + 1) : id;
  const parent = Object.hasOwn(DS_MAP_PART_PARENTS, local) ? DS_MAP_PART_PARENTS[local] : undefined;
  if (!parent) return undefined;
  return colon > 0 ? `${id.slice(0, colon)}:${parent}` : parent;
}

/** Most values one axis list is read for (`DS_LOCKED_LIMITS.axisValues`). */
const AXIS_VALUES_CAP = 32;

/**
 * The values an allow entry's axis list enables, read in its declared shape (0.17.2): a list
 * of values; a single value (`"ghost"`); or an object, either `{ values: [...] }` or a map of
 * value → `true`. `undefined` (every catalog value) when the field is omitted or holds no
 * readable shape; `[]` (none) only for an empty list or a map that enables nothing. The static
 * and the render checks both read lists through this.
 */
export function dsAllowAxisValues(listed: unknown): readonly string[] | undefined {
  const strings = (items: readonly unknown[]): string[] =>
    items
      .slice(0, AXIS_VALUES_CAP)
      .filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (Array.isArray(listed)) return strings(listed);
  if (typeof listed === 'string') return listed.length > 0 ? [listed] : undefined;
  if (!isRecord(listed)) return undefined;
  if (Array.isArray(listed.values)) return strings(listed.values);
  if (typeof listed.values === 'string') return dsAllowAxisValues(listed.values);
  const keys = Object.keys(listed).slice(0, AXIS_VALUES_CAP);
  if (keys.length === 0) return undefined;
  return keys.filter((key) => listed[key] === true);
}

/**
 * Cap per finding code (matches `DESIGN_SYSTEM_LIMITS.errors`): each of `render-disabled-value`,
 * `not-allowed` and `unmapped` keeps up to this many, so a page full of one kind never crowds
 * out the others (0.17.1).
 */
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
  /** Child → parent catalog ids (library `composes`, host extensions). */
  readonly composed?: Readonly<Record<string, string>>;
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

function allowedIds(manifest: DsMapAllowManifest | undefined): Set<string> | undefined {
  if (!manifest || manifest.allow === undefined) return undefined;
  return new Set(Object.keys(manifest.allow));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const localId = (id: string): string => (id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : id);

/** The composed parent of `id`: an own string value only (page JSON may carry anything). */
function composedParent(
  composed: Readonly<Record<string, string>> | undefined,
  id: string
): string | undefined {
  if (!isRecord(composed) || !Object.hasOwn(composed, id)) return undefined;
  const parent = (composed as Record<string, unknown>)[id];
  return typeof parent === 'string' && parent.length > 0 ? parent : undefined;
}

/**
 * Whether `id` is a declared part of `parent`: a compound part (`select-trigger` of
 * `select`, also across an extension namespace) or an id `composed` maps to it.
 */
function isPartOf(
  id: string,
  parent: string,
  composed: Readonly<Record<string, string>> | undefined
): boolean {
  const localParent = localId(parent);
  const target = composedParent(composed, id) ?? composedParent(composed, localId(id));
  if (target !== undefined && (target === parent || localId(target) === localParent)) return true;
  return dsCatalogPartParent(localId(id)) === localParent;
}

/**
 * The allow key that covers `id`: itself, a compound parent (`select-trigger` →
 * `select`), an extension local id (`acme:select-trigger` → `acme:select` or
 * `select`), a composed parent, or the allowed DOM ancestor catalog root **when `id` is a
 * declared part or composed id of it** (0.17.1: any other nested root, such as a data-grid
 * inside an allowed card, is not covered, as in 0.16.1).
 */
export function resolveAllowedComponentId(
  id: string,
  allowed: ReadonlySet<string>,
  options: { composed?: Readonly<Record<string, string>>; ancestor?: string } = {}
): string | undefined {
  if (!id) return undefined;
  if (allowed.has(id)) return id;
  const composed = composedParent(options.composed, id);
  if (composed && allowed.has(composed)) return composed;
  if (
    options.ancestor &&
    allowed.has(options.ancestor) &&
    isPartOf(id, options.ancestor, options.composed)
  )
    return options.ancestor;
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
  // A declared part standing alone is covered by its allowed parent (0.17.1); a hyphen
  // prefix alone covers nothing (0.17.2: alert-dialog is not a part of alert).
  const parent = dsCatalogPartParent(id);
  if (parent && allowed.has(parent)) return parent;
  if (parent && colon > 0 && allowed.has(localId(parent))) return localId(parent);
  return undefined;
}

function ancestorCatalogId(el: Element): string | undefined {
  const owner = el.parentElement?.closest(ROOT_SELECTOR);
  const id = owner?.getAttribute(COMPONENT_ATTRIBUTE);
  return id || undefined;
}

function allowAxisValues(entry: unknown, field: string): readonly string[] | undefined {
  return isRecord(entry) ? dsAllowAxisValues(entry[field]) : undefined;
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
  if (errors.filter((issue) => issue.code === code).length >= DS_MAP_MAX_ISSUES) return;
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
        composed: options.composed ?? options.allowManifest?.composed,
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
    if (seen.has(el)) continue;
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
        composed: options.composed ?? options.allowManifest?.composed,
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

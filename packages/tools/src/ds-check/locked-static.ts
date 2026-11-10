/**
 * The static checker core of locked design systems (ADR-032, PLAN_016 T-t5-static): which
 * catalog components a prototype uses, with which variants, sizes, tones, densities, colors and
 * states, checked against the allow manifest and the catalog. Pure functions, no browser
 * and no file system: the caller passes source text or a blueprint.
 *
 * - {@link usageFromSource} reads a Svelte or TypeScript file: its imports are mapped to
 *   catalog ids through the catalog's `imports` field (module + export name), and every
 *   Svelte tag of an imported component becomes a usage with its static attributes.
 * - {@link usageFromBlueprint} reads a blueprint tree (`{ id, props, children }` nodes).
 * - {@link checkLockedUsage} checks the usages and reports each problem with a stable code
 *   and a location (`file:line:column` or a JSON path).
 *
 * Codes: `not-allowed` (a component the allow set does not list, the mapper's code),
 * `variant-not-allowed`, `size-not-allowed`, `tone-not-allowed`, `density-not-allowed`,
 * `color-not-allowed`, `state-not-allowed` (a value the allow set disables), and `unknown-component`,
 * `unknown-variant`, `unknown-size`, `unknown-tone`, `unknown-density`, `unknown-color`, `unknown-state` (an id
 * or value the catalog does not list, as `checkDesignSystemAllow` names them). A value the
 * checker cannot read statically (`variant={x}`) is a `dynamic-value` warning, never an error.
 * Disallowed variants are flagged, never removed at runtime (ADR-032). Extension ids
 * (`<ns>:<id>`) are plain catalog ids here.
 */
import { dsAllowAxisValues, resolveAllowedComponentId } from './map.ts';
import type { DsCheckIssue } from './types.ts';

/** The axes a component can have, and the allow list each reads. */
export const LOCKED_AXES = [
  ['variant', 'variants'],
  ['size', 'sizes'],
  ['tone', 'tones'],
  ['density', 'densities'],
  ['color', 'colors'],
] as const;
export type LockedAxis = (typeof LOCKED_AXES)[number][0];

/** The props that put a component in a state, by state (the catalog's closed state list). */
export const LOCKED_STATE_PROPS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  disabled: ['disabled'],
  loading: ['loading'],
  invalid: ['invalid', 'aria-invalid'],
  selected: ['selected'],
  expanded: ['expanded'],
  checked: ['checked'],
  open: ['open'],
  readonly: ['readonly', 'readOnly'],
});

export const LOCKED_STATIC_CODES = [
  'not-allowed',
  'variant-not-allowed',
  'size-not-allowed',
  'tone-not-allowed',
  'density-not-allowed',
  'color-not-allowed',
  'state-not-allowed',
  'unknown-component',
  'unknown-variant',
  'unknown-size',
  'unknown-tone',
  'unknown-density',
  'unknown-color',
  'unknown-state',
] as const;
export type LockedStaticCode = (typeof LOCKED_STATIC_CODES)[number];

/** The most issues one check returns (the spec's error ceiling). */
export const LOCKED_STATIC_MAX_ISSUES = 64;
/** The largest source text the reader scans, in characters. */
export const LOCKED_STATIC_MAX_SOURCE = 1_000_000;
/** The most component usages one source yields (the rest of the file is not read). */
export const LOCKED_STATIC_MAX_USAGES = 10_000;

/** One catalog component as the checker reads it (`packages/spec/catalog/components.json`). */
export interface LockedCatalogComponent {
  readonly id: string;
  readonly imports?: readonly { readonly module: string; readonly exports: readonly string[] }[];
  readonly axes?: Readonly<
    Partial<Record<LockedAxis, { readonly prop: string; readonly values: readonly string[] }>>
  >;
  readonly states?: readonly string[];
}

export interface LockedCatalog {
  readonly components: readonly LockedCatalogComponent[];
}

/** The allow manifest (or a document's `allow`): omitted `allow` means unlocked. */
export interface LockedAllowManifest {
  readonly allow?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/** Where a usage was found. */
export interface LockedLocation {
  /** The source file, for a source usage. */
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  /** A JSON path, for a blueprint usage (`$.tree.children[0]`). */
  readonly path?: string;
}

/** A value read statically, or `{ dynamic: true }` for an expression the checker cannot read. */
export type LockedValue = string | boolean | { readonly dynamic: true };

/** One use of a catalog component. */
export interface LockedUsage {
  readonly component: string;
  /** Prop name → value (static string, `true` for a bare attribute, or dynamic). */
  readonly props: Readonly<Record<string, LockedValue>>;
  readonly location: LockedLocation;
}

export interface LockedStaticIssue extends DsCheckIssue {
  readonly component: string;
  readonly location: LockedLocation;
  /** The axis or state value that failed. */
  readonly value?: string;
}

export interface LockedStaticReport {
  /** True when no error was found (warnings do not fail). */
  readonly ok: boolean;
  /** Distinct error codes, sorted. */
  readonly codes: string[];
  readonly errors: LockedStaticIssue[];
  /** `dynamic-value`: a prop the checker could not read statically. */
  readonly warnings: LockedStaticIssue[];
  /** The components checked, with how many uses each. */
  readonly components: Readonly<Record<string, number>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** `file:line:column`, or the JSON path. */
export function locationText(location: LockedLocation): string {
  if (location.path !== undefined) return location.path;
  const file = location.file ?? '<source>';
  return location.line === undefined ? file : `${file}:${location.line}:${location.column ?? 1}`;
}

// ─── Reading sources ──────────────────────────────────────────────────────

/** Import specifier → catalog id, from the catalog's `imports` field. */
export function catalogImportIndex(catalog: LockedCatalog): Map<string, string> {
  const index = new Map<string, string>();
  for (const component of catalog.components)
    for (const entry of component.imports ?? [])
      for (const name of entry.exports) {
        const key = `${entry.module}#${name}`;
        if (!index.has(key)) index.set(key, component.id);
      }
  return index;
}

const IMPORT =
  /import\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;

/** Local name → catalog id for the imports of one source text. */
export function importedComponents(
  source: string,
  index: Map<string, string>
): Map<string, string> {
  const locals = new Map<string, string>();
  for (const match of source.matchAll(IMPORT)) {
    const [statement, defaultName, named, module] = match;
    if (statement.startsWith('import type')) continue;
    if (defaultName) {
      const id = index.get(`${module}#default`);
      if (id) locals.set(defaultName, id);
    }
    for (const part of (named ?? '').split(',')) {
      const spec = part.trim();
      if (!spec || spec.startsWith('type ')) continue;
      const [imported, local] = spec.split(/\s+as\s+/).map((s) => s.trim());
      let id = imported ? index.get(`${module}#${imported}`) : undefined;
      // Primitive namespace parts are public building blocks, not catalog
      // entries. If a compound import uses dotted tags, resolve its root to
      // the unique catalog owner of the same public namespace name instead.
      if (
        !id &&
        imported &&
        module?.startsWith('@texuli/primitives/') &&
        new RegExp(`<${(local ?? imported).replace(/[$]/gu, '\\$')}\\.[A-Z]`, 'u').test(source)
      ) {
        const owners = new Set(
          [...index.entries()]
            .filter(
              ([key]) => key.endsWith(`#${imported}`) && !key.startsWith('@texuli/primitives/')
            )
            .map(([, owner]) => owner)
        );
        if (owners.size === 1) id = owners.values().next().value;
      }
      if (id) locals.set(local ?? (imported as string), id);
    }
  }
  return locals;
}

/**
 * A line and column (1-based) finder for one source: the line starts are computed once, and
 * each lookup is a binary search, so locating n tags in a file is O(n log lines), not
 * O(n × size).
 */
function positions(source: string): (offset: number) => { line: number; column: number } {
  const starts = [0];
  for (let i = source.indexOf('\n'); i !== -1; i = source.indexOf('\n', i + 1)) starts.push(i + 1);
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if ((starts[mid] as number) <= offset) low = mid;
      else high = mid - 1;
    }
    return { line: low + 1, column: offset - (starts[low] as number) + 1 };
  };
}

/** The end of a `{…}` expression starting at `start` (balanced braces, strings skipped). */
function braceEnd(source: string, start: number): number {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === '"' || char === "'" || char === '`') {
      const close = source.indexOf(char, i + 1);
      if (close === -1) return source.length;
      i = close;
    } else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return source.length;
}

/** A literal inside `{…}`: `'ghost'`, `"ghost"`, `true` and `false` are static. */
function expressionValue(expression: string): LockedValue {
  const text = expression.trim();
  const quoted = /^(['"])([^'"\\]*)\1$/.exec(text);
  if (quoted) return quoted[2] as string;
  if (text === 'true') return true;
  if (text === 'false') return false;
  return { dynamic: true };
}

/** The attributes of one tag, from just after its name to its `>`; returns the props and the end. */
function readAttributes(
  source: string,
  from: number
): { props: Record<string, LockedValue>; end: number } {
  const props: Record<string, LockedValue> = {};
  let i = from;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i] as string)) i += 1;
    const char = source[i];
    if (char === undefined || char === '>' || (char === '/' && source[i + 1] === '>')) break;
    if (char === '{') {
      // `{...rest}` or a shorthand `{variant}`.
      const end = braceEnd(source, i);
      const inner = source.slice(i + 1, end).trim();
      if (inner.startsWith('...')) props['...'] = { dynamic: true };
      else if (/^[A-Za-z_$][\w$]*$/.test(inner)) props[inner] = { dynamic: true };
      i = end + 1;
      continue;
    }
    const name = /^[^\s=>/{}"']+/.exec(source.slice(i))?.[0];
    if (!name) {
      i += 1;
      continue;
    }
    i += name.length;
    while (i < source.length && /\s/.test(source[i] as string)) i += 1;
    if (source[i] !== '=') {
      props[name] = true;
      continue;
    }
    i += 1;
    while (i < source.length && /\s/.test(source[i] as string)) i += 1;
    const quote = source[i];
    if (quote === '"' || quote === "'") {
      const close = source.indexOf(quote, i + 1);
      const raw = source.slice(i + 1, close === -1 ? source.length : close);
      props[name] = raw.includes('{') ? { dynamic: true } : raw;
      i = close === -1 ? source.length : close + 1;
    } else if (quote === '{') {
      const end = braceEnd(source, i);
      props[name] = expressionValue(source.slice(i + 1, end));
      i = end + 1;
    } else {
      const raw = /^[^\s>]+/.exec(source.slice(i))?.[0] ?? '';
      props[name] = raw;
      i += raw.length;
    }
  }
  return { props, end: i };
}

/**
 * The catalog components one Svelte or TypeScript file uses. Imports map local names to
 * catalog ids; in Svelte markup each `<Name …>` tag of an imported component is a usage with
 * its static attributes. A component imported but never used as a tag (a TypeScript module,
 * or `mount(Button, …)`) is one usage at its import, without props.
 */
export function usageFromSource(
  file: string,
  source: string,
  catalog: LockedCatalog
): LockedUsage[] {
  const text = source.slice(0, LOCKED_STATIC_MAX_SOURCE);
  const locals = importedComponents(text, catalogImportIndex(catalog));
  if (locals.size === 0) return [];
  const usages: LockedUsage[] = [];
  const used = new Set<string>();
  const position = positions(text);
  const markupStart = text.lastIndexOf('</script>');
  const markup = markupStart === -1 && !file.endsWith('.svelte') ? '' : text;
  const from = markupStart === -1 ? 0 : markupStart;
  const tag = /<([A-Z][\w$]*(?:\.[\w$]+)?)(?=[\s/>])/g;
  tag.lastIndex = from;
  for (let match = tag.exec(markup); match; match = tag.exec(markup)) {
    if (usages.length >= LOCKED_STATIC_MAX_USAGES) break;
    const name = match[1] as string;
    // Compound namespaces are imported as one public root (`Select`) while
    // Svelte uses their members as dotted tags (`<Select.Content>`). The
    // catalog owns the namespace root, so every part inherits that same id
    // and the design-system allow set governs the whole compound.
    const namespace = name.indexOf('.');
    const id =
      locals.get(name) ?? (namespace === -1 ? undefined : locals.get(name.slice(0, namespace)));
    if (!id) continue;
    used.add(namespace === -1 ? name : name.slice(0, namespace));
    const { props, end } = readAttributes(markup, match.index + match[0].length);
    usages.push({ component: id, props, location: { file, ...position(match.index) } });
    tag.lastIndex = end;
  }
  for (const [name, id] of locals) {
    if (used.has(name)) continue;
    const at = text.search(new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`));
    usages.push({
      component: id,
      props: {},
      location: { file, ...position(Math.max(at, 0)) },
    });
  }
  return usages;
}

/**
 * The catalog components a blueprint uses: every `{ id, props, children }` node of its `tree`
 * (or of the value itself), with a JSON path. Prop values that are not strings or booleans
 * (bindings, expressions) are dynamic.
 */
export function usageFromBlueprint(blueprint: unknown): LockedUsage[] {
  const usages: LockedUsage[] = [];
  const root = isRecord(blueprint) && isRecord(blueprint.tree) ? blueprint.tree : blueprint;
  const start = root === blueprint ? '$' : '$.tree';
  const visit = (node: unknown, path: string, depth: number) => {
    if (!isRecord(node) || depth > 64 || usages.length >= 10_000) return;
    if (typeof node.id === 'string') {
      const props: Record<string, LockedValue> = {};
      if (isRecord(node.props))
        for (const [key, value] of Object.entries(node.props))
          props[key] =
            typeof value === 'string' || typeof value === 'boolean' ? value : { dynamic: true };
      usages.push({ component: node.id, props, location: { path } });
    }
    if (Array.isArray(node.children))
      for (const [i, child] of node.children.entries())
        visit(child, `${path}.children[${i}]`, depth + 1);
    if (isRecord(node.slots))
      for (const [slot, children] of Object.entries(node.slots))
        if (Array.isArray(children))
          for (const [i, child] of children.entries())
            visit(child, `${path}.slots.${slot}[${i}]`, depth + 1);
  };
  visit(root, start, 0);
  return usages;
}

// ─── Checking ─────────────────────────────────────────────────────────────

/** An axis or state list in its declared shape (list, single value or object; 0.17.2). */
const strings = (value: unknown): readonly string[] | undefined => dsAllowAxisValues(value);

/**
 * Check usages against the allow manifest and the catalog. Unlocked (no `allow`): only
 * catalog membership is checked. Locked: a component not listed is `not-allowed`; a listed
 * one is checked axis by axis (an omitted list allows every catalog value) and state by
 * state. Pure; at most {@link LOCKED_STATIC_MAX_ISSUES} errors.
 */
export function checkLockedUsage(
  usages: readonly LockedUsage[],
  options: { catalog: LockedCatalog; allowManifest?: LockedAllowManifest }
): LockedStaticReport {
  const byId = new Map(options.catalog.components.map((c) => [c.id, c]));
  const allow = options.allowManifest?.allow;
  const errors: LockedStaticIssue[] = [];
  const warnings: LockedStaticIssue[] = [];
  const components: Record<string, number> = {};
  const add = (
    list: LockedStaticIssue[],
    code: string,
    usage: LockedUsage,
    message: string,
    extra: { value?: string; hint?: string } = {}
  ) => {
    if (list.length >= LOCKED_STATIC_MAX_ISSUES) return;
    list.push({
      code,
      path: locationText(usage.location),
      message,
      component: usage.component,
      location: usage.location,
      ...(extra.value !== undefined ? { value: extra.value } : {}),
      ...(extra.hint ? { hint: extra.hint } : {}),
    });
  };

  for (const usage of usages) {
    // Past the error cap nothing new can be reported: stop reading.
    if (errors.length >= LOCKED_STATIC_MAX_ISSUES && warnings.length >= LOCKED_STATIC_MAX_ISSUES)
      break;
    components[usage.component] = (components[usage.component] ?? 0) + 1;
    const component = byId.get(usage.component);
    if (!component) {
      add(errors, 'unknown-component', usage, `${usage.component} is not a catalog component.`);
      continue;
    }
    // A declared catalog part (select-trigger) is governed by its allowed parent (select),
    // exactly as the render check resolves it; a hyphen prefix alone governs nothing.
    const key = allow
      ? Object.hasOwn(allow, component.id)
        ? component.id
        : resolveAllowedComponentId(component.id, new Set(Object.keys(allow)))
      : undefined;
    const entry = allow ? (key === undefined ? undefined : allow[key]) : {};
    if (!entry) {
      add(errors, 'not-allowed', usage, `${component.id} is not in this design system.`, {
        hint: 'Use a component the allow set lists, or ask the design reviewer to allow it.',
      });
      continue;
    }
    for (const [axis, list] of LOCKED_AXES) {
      const spec = component.axes?.[axis];
      if (!spec) continue;
      const value = usage.props[spec.prop];
      if (value === undefined || typeof value === 'boolean') continue;
      if (typeof value !== 'string') {
        add(
          warnings,
          'dynamic-value',
          usage,
          `${component.id} sets ${spec.prop} from an expression.`,
          {
            hint: 'Use a literal value so the lock can be checked, or rely on the render check.',
          }
        );
        continue;
      }
      if (!spec.values.includes(value)) {
        add(errors, `unknown-${axis}`, usage, `${component.id} has no ${axis} "${value}".`, {
          value,
          hint: `Catalog values: ${spec.values.join(', ')}.`,
        });
        continue;
      }
      const allowed = strings(isRecord(entry) ? entry[list] : undefined);
      if (allowed && !allowed.includes(value))
        add(
          errors,
          `${axis}-not-allowed`,
          usage,
          `${component.id} ${axis} "${value}" is not allowed.`,
          {
            value,
            hint: allowed.length > 0 ? `Allowed: ${allowed.join(', ')}.` : `No ${axis} is allowed.`,
          }
        );
    }
    const allowedStates = strings(isRecord(entry) ? entry.states : undefined);
    for (const [state, names] of Object.entries(LOCKED_STATE_PROPS)) {
      const name = names.find((n) => Object.hasOwn(usage.props, n));
      if (name === undefined) continue;
      const value = usage.props[name];
      if (value === false || value === 'false') continue;
      if (typeof value === 'object') {
        add(warnings, 'dynamic-value', usage, `${component.id} sets ${name} from an expression.`, {
          hint: 'The state is checked when it is a literal; otherwise rely on the render check.',
        });
        continue;
      }
      if (!(component.states ?? []).includes(state)) {
        add(
          errors,
          'unknown-state',
          usage,
          `${component.id} has no ${state} state in the catalog.`,
          {
            value: state,
          }
        );
        continue;
      }
      if (allowedStates && !allowedStates.includes(state))
        add(
          errors,
          'state-not-allowed',
          usage,
          `${component.id} state "${state}" is not allowed.`,
          {
            value: state,
            hint:
              allowedStates.length > 0
                ? `Allowed: ${allowedStates.join(', ')}.`
                : 'No state is allowed.',
          }
        );
    }
  }
  return {
    ok: errors.length === 0,
    codes: [...new Set(errors.map((e) => e.code))].sort(),
    errors,
    warnings,
    components,
  };
}

/** Read and check many source files in one call: `{ path → text }`. */
export function checkLockedSources(
  files: Readonly<Record<string, string>>,
  options: { catalog: LockedCatalog; allowManifest?: LockedAllowManifest }
): LockedStaticReport {
  const usages = Object.keys(files)
    .sort()
    .flatMap((file) => usageFromSource(file, files[file] as string, options.catalog));
  return checkLockedUsage(usages, options);
}

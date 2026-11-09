/**
 * Catalog membership of a design-system `allow` list (ADR-032): unknown
 * component ids, and variant / size / tone / density / state values the
 * component's axes or states do not list. Pure and total over JSON values;
 * the catalog is an argument, never imported, so the bundled validator does
 * not carry it.
 *
 * An omitted axis or states list allows every value the catalog lists; an
 * empty list allows none. A document without `allow` is not locked. Caps
 * match {@link DESIGN_SYSTEM_LIMITS.errors} and {@link DS_LOCKED_LIMITS}.
 */
import type { DesignSystemIssue } from '../../generated/typescript/design-system.ts';
import { isRecord } from '../dialect.ts';
import { DS_LOCKED_LIMITS } from './types-locked.ts';
import { DESIGN_SYSTEM_ALLOW_CODES, DESIGN_SYSTEM_LIMITS, DS_RESERVED_KEYS } from './vocabulary.ts';

/** One catalog component as `checkDesignSystemAllow` reads it. */
export interface DesignSystemAllowCatalogComponent {
  readonly id: string;
  readonly axes?: {
    readonly variant?: { readonly values?: readonly string[] };
    readonly size?: { readonly values?: readonly string[] };
    readonly tone?: { readonly values?: readonly string[] };
    readonly density?: { readonly values?: readonly string[] };
  };
  readonly states?: readonly string[];
}

/** A catalog argument: the spec catalog or a stub with the same `components`. */
export interface DesignSystemAllowCatalog {
  readonly components: readonly DesignSystemAllowCatalogComponent[];
}

export type DesignSystemAllowCode = (typeof DESIGN_SYSTEM_ALLOW_CODES)[number];

const AXES = [
  ['variants', 'variant', 'unknown-variant'],
  ['sizes', 'size', 'unknown-size'],
  ['tones', 'tone', 'unknown-tone'],
  ['densities', 'density', 'unknown-density'],
] as const;

const at = (path: string, key: string | number): string =>
  typeof key === 'number'
    ? `${path}[${key}]`
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;

const add = (
  errors: DesignSystemIssue[],
  max: number,
  code: DesignSystemAllowCode,
  path: string,
  message: string
): undefined => {
  if (errors.length < max) errors.push({ code, path, message });
};

/** Index catalog components by id; hostile catalogs are bounded and never throw. */
function catalogById(catalog: unknown): Map<string, DesignSystemAllowCatalogComponent> {
  const map = new Map<string, DesignSystemAllowCatalogComponent>();
  if (!isRecord(catalog)) return map;
  const list = catalog.components;
  if (!Array.isArray(list)) return map;
  const cap = Math.min(list.length, 512);
  for (let i = 0; i < cap; i++) {
    const entry = list[i];
    if (!isRecord(entry) || typeof entry.id !== 'string' || map.has(entry.id)) continue;
    map.set(entry.id, entry as unknown as DesignSystemAllowCatalogComponent);
  }
  return map;
}

const axisValues = (
  component: DesignSystemAllowCatalogComponent,
  axis: (typeof AXES)[number][1]
): ReadonlySet<string> | undefined => {
  const listed = component.axes?.[axis]?.values;
  if (!Array.isArray(listed)) return;
  const values = new Set<string>();
  for (const value of listed) if (typeof value === 'string') values.add(value);
  return values;
};

/**
 * Check `doc.allow` (and `library[].composes`) against `catalog`. Never
 * throws; never echoes unbounded input into messages. Output stops at 64
 * issues.
 */
export function checkDesignSystemAllow(
  doc: unknown,
  catalog: DesignSystemAllowCatalog
): { ok: boolean; errors: readonly DesignSystemIssue[] } {
  const errors: DesignSystemIssue[] = [];
  const max = DESIGN_SYSTEM_LIMITS.errors;
  if (!isRecord(doc)) return { ok: true, errors };
  const byId = catalogById(catalog);
  const allow = isRecord(doc.allow) ? doc.allow : undefined;
  const keys = allow ? Object.keys(allow) : [];
  const cap = Math.min(keys.length, DS_LOCKED_LIMITS.allowComponents);
  for (let i = 0; i < cap && errors.length < max; i++) {
    const id = keys[i] as string;
    if (DS_RESERVED_KEYS.has(id)) continue;
    const path = at('$.allow', id);
    const component = byId.get(id);
    if (!component) {
      add(errors, max, 'unknown-component', path, 'Unknown catalog component.');
      continue;
    }
    const entry = allow?.[id];
    if (!isRecord(entry)) continue;
    for (const [field, axis, code] of AXES) {
      const listed = entry[field];
      if (listed === undefined || !Array.isArray(listed)) continue;
      const allowed = axisValues(component, axis);
      const n = Math.min(listed.length, DS_LOCKED_LIMITS.axisValues);
      for (let j = 0; j < n && errors.length < max; j++) {
        const value = listed[j];
        if (typeof value !== 'string') continue;
        if (!allowed?.has(value))
          add(errors, max, code, `${at(path, field)}[${j}]`, `Unknown ${axis}.`);
      }
    }
    const states = entry.states;
    if (Array.isArray(states)) {
      const allowed = new Set(
        Array.isArray(component.states)
          ? component.states.filter((state): state is string => typeof state === 'string')
          : []
      );
      const n = Math.min(states.length, DS_LOCKED_LIMITS.axisValues);
      for (let j = 0; j < n && errors.length < max; j++) {
        const value = states[j];
        if (typeof value !== 'string') continue;
        if (!allowed.has(value))
          add(errors, max, 'unknown-state', `${at(path, 'states')}[${j}]`, 'Unknown state.');
      }
    }
  }
  const library = doc.library;
  if (Array.isArray(library)) {
    const n = Math.min(library.length, DS_LOCKED_LIMITS.library);
    for (let i = 0; i < n && errors.length < max; i++) {
      const entry = library[i];
      if (!isRecord(entry) || !Array.isArray(entry.composes)) continue;
      const composed = entry.composes;
      const count = Math.min(composed.length, DS_LOCKED_LIMITS.composes);
      for (let j = 0; j < count && errors.length < max; j++) {
        const id = composed[j];
        if (typeof id !== 'string') continue;
        if (!byId.has(id))
          add(
            errors,
            max,
            'unknown-component',
            `${at(at('$.library', i), 'composes')}[${j}]`,
            'Unknown catalog component.'
          );
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

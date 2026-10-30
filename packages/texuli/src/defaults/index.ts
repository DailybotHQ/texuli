/**
 * `texuli/defaults`: component defaults for design systems and agents
 * (ADR-020). Token contract v2 restyles components through CSS tokens; the
 * default `variant` and `size` cannot be CSS, so a Svelte context carries
 * them. A component uses a default only when its prop is undefined, and
 * nothing is read or allocated when no provider is set.
 *
 * ```svelte
 * <script lang="ts">
 *   import { setDesignDefaults } from 'texuli/defaults';
 *   setDesignDefaults({ button: { variant: 'outline', size: 'sm' }, card: { variant: 'flat' } });
 * </script>
 * ```
 *
 * The vocabulary is closed: unknown components, props or values are dropped
 * and reported (`DesignDefaultsIssue`), never passed through, so defaults
 * written by an agent can never select a class that does not exist.
 */
import { getContext, setContext } from 'svelte';
import { DESIGN_DEFAULTS_KEY, type DesignDefaultsResolver } from '../internal/design-defaults.ts';
import {
  type ComponentDefaults,
  DESIGN_DEFAULTS_COMPONENTS,
  DESIGN_DEFAULTS_VOCABULARY,
  type DesignDefaults,
  type DesignDefaultsComponent,
} from './vocabulary.ts';

export {
  type ComponentDefaults,
  DESIGN_DEFAULTS_COMPONENTS,
  DESIGN_DEFAULTS_VOCABULARY,
  type DesignDefaults,
  type DesignDefaultsComponent,
} from './vocabulary.ts';

/** One refused entry, with the path an author or agent can fix. */
export interface DesignDefaultsIssue {
  /** `button.variant`, `buton`, or `` for a non-object input. */
  readonly path: string;
  readonly code: 'not-object' | 'unknown-component' | 'unknown-prop' | 'unknown-value';
  readonly message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const owns = (record: object, key: string) => Object.hasOwn(record, key);

/**
 * Keep only the vocabulary: known components, `variant` / `size` props each
 * listed for that component, and values from its closed list. Everything else
 * is dropped and reported. Accepts untrusted input (agent output, JSON).
 */
export function validateDesignDefaults(input: unknown): {
  defaults: DesignDefaults;
  issues: DesignDefaultsIssue[];
} {
  const issues: DesignDefaultsIssue[] = [];
  const defaults: Record<string, Record<string, string>> = {};
  if (!isRecord(input)) {
    issues.push({ path: '', code: 'not-object', message: 'Design defaults must be an object.' });
    return { defaults: {}, issues };
  }
  for (const component of Object.keys(input)) {
    const value = input[component];
    if (!owns(DESIGN_DEFAULTS_VOCABULARY, component)) {
      issues.push({
        path: component,
        code: 'unknown-component',
        message: `Unknown component "${component}".`,
      });
      continue;
    }
    if (value === undefined) continue;
    if (!isRecord(value)) {
      issues.push({ path: component, code: 'not-object', message: 'Expected an object.' });
      continue;
    }
    const allowed = DESIGN_DEFAULTS_VOCABULARY[component as DesignDefaultsComponent] as Record<
      string,
      readonly string[]
    >;
    const kept: Record<string, string> = {};
    for (const prop of Object.keys(value)) {
      const chosen = value[prop];
      const path = `${component}.${prop}`;
      if (!owns(allowed, prop)) {
        issues.push({
          path,
          code: 'unknown-prop',
          message: `"${component}" has no default "${prop}".`,
        });
        continue;
      }
      if (chosen === undefined) continue;
      if (typeof chosen !== 'string' || !(allowed[prop] as readonly string[]).includes(chosen)) {
        issues.push({
          path,
          code: 'unknown-value',
          message: `Expected one of ${(allowed[prop] as readonly string[]).join(', ')}.`,
        });
        continue;
      }
      kept[prop] = chosen;
    }
    if (Object.keys(kept).length > 0) defaults[component] = kept;
  }
  return { defaults: defaults as DesignDefaults, issues };
}

/** Merge two defaults maps per component; `override` wins prop by prop. */
export function mergeDesignDefaults(
  base: DesignDefaults,
  override: DesignDefaults
): DesignDefaults {
  const merged: Record<string, object> = { ...base };
  for (const component of Object.keys(override) as DesignDefaultsComponent[]) {
    merged[component] = { ...base[component], ...override[component] };
  }
  return merged as DesignDefaults;
}

/**
 * Provide component defaults to every Texuli component below this one. Call
 * during component initialisation (like `setContext`). Nested providers merge:
 * the inner one wins per component and prop. Pass a function to keep the
 * defaults reactive (`setDesignDefaults(() => ({ button: { size } }))`).
 * Returns the refused entries of the first read.
 */
export function setDesignDefaults(
  defaults: DesignDefaults | (() => DesignDefaults)
): readonly DesignDefaultsIssue[] {
  const parent = getContext<DesignDefaultsResolver | undefined>(DESIGN_DEFAULTS_KEY);
  const inherited = parent ?? (() => ({}));
  let resolve: DesignDefaultsResolver;
  let issues: DesignDefaultsIssue[];
  if (typeof defaults === 'function') {
    issues = validateDesignDefaults(defaults()).issues;
    resolve = () => mergeDesignDefaults(inherited(), validateDesignDefaults(defaults()).defaults);
  } else {
    const checked = validateDesignDefaults(defaults);
    issues = checked.issues;
    resolve = () => mergeDesignDefaults(inherited(), checked.defaults);
  }
  setContext(DESIGN_DEFAULTS_KEY, resolve);
  return issues;
}

/**
 * The defaults in effect here (merged across nested providers), or `{}`.
 * Call during component initialisation; read the result in markup or
 * `$derived` to follow reactive providers.
 */
export function getDesignDefaults(): DesignDefaults;
export function getDesignDefaults<C extends DesignDefaultsComponent>(
  component: C
): ComponentDefaults<C>;
export function getDesignDefaults(component?: DesignDefaultsComponent): object {
  const resolve = getContext<DesignDefaultsResolver | undefined>(DESIGN_DEFAULTS_KEY);
  const all = resolve ? resolve() : {};
  return component ? ((all as Record<string, object>)[component] ?? {}) : all;
}

/** True when `id` names a component in the defaults vocabulary. */
export function isDesignDefaultsComponent(id: string): id is DesignDefaultsComponent {
  return (DESIGN_DEFAULTS_COMPONENTS as readonly string[]).includes(id);
}

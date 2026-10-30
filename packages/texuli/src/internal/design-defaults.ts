/**
 * The component side of the design defaults context (ADR-020): a styled
 * component reads its default `variant` and `size` here, and uses them only
 * when the prop is undefined. Type-only imports keep this module free of the
 * vocabulary lists; `setDesignDefaults` (`texuli/defaults`) validates and
 * provides the values.
 */
import { getContext } from 'svelte';
import type {
  ComponentDefaults,
  DesignDefaults,
  DesignDefaultsComponent,
} from '../defaults/vocabulary.ts';

/** The context key `setDesignDefaults` provides (shared across package copies). */
export const DESIGN_DEFAULTS_KEY: unique symbol = Symbol.for('texuli.design-defaults') as never;

/** The provided value: resolves the merged defaults on every read, so they stay reactive. */
export type DesignDefaultsResolver = () => DesignDefaults;

const NONE = Object.freeze({});
const none = () => NONE;

/**
 * Read one component's defaults. Call during component initialisation; the
 * returned getter is cheap and reactive (call it inside `$derived`). Without a
 * provider it returns an empty object, so the cost is one `getContext`.
 */
export function designDefaults<C extends DesignDefaultsComponent>(
  component: C
): () => ComponentDefaults<C> {
  const resolve = getContext<DesignDefaultsResolver | undefined>(DESIGN_DEFAULTS_KEY);
  if (!resolve) return none as () => ComponentDefaults<C>;
  return () => (resolve()[component] ?? NONE) as ComponentDefaults<C>;
}

/** The prop when set, otherwise the design default, otherwise the built-in fallback. */
export function withDefault<T>(prop: T | undefined, designed: T | undefined, fallback: T): T {
  if (prop !== undefined) return prop;
  return designed !== undefined ? designed : fallback;
}

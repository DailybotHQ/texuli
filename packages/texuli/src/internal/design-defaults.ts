/**
 * The component side of the design defaults context (ADR-020): a styled
 * component reads its default `variant` and `size` here, and uses them only
 * when the prop is undefined (a reactive prop fallback:
 * `let { variant = txDefaults().variant ?? 'default' } = $props()`). Type-only imports keep this module free of the
 * vocabulary lists; `setDesignDefaults` (`texuli/defaults`) validates and
 * provides the values.
 */
import { getContext } from 'svelte';
import type {
  ComponentDefaults,
  DesignDefaults,
  DesignDefaultsComponent,
} from '../defaults/vocabulary.ts';

/** The context key `setDesignDefaults` provides (a string, so package copies share it). */
export const DESIGN_DEFAULTS_KEY = 'texuli.design-defaults';

/** The provided value: resolves the merged defaults on every read, so they stay reactive. */
export type DesignDefaultsResolver = () => DesignDefaults;

/**
 * Read one component's defaults. Call during component initialisation; the
 * returned getter is reactive (a prop fallback or `$derived` re-reads it).
 * Without a provider it returns `{}`, so the cost is one `getContext`. Kept
 * tiny on purpose: every styled component bundles it.
 */
export function designDefaults<C extends DesignDefaultsComponent>(
  component: C
): () => ComponentDefaults<C> {
  const resolve = getContext<DesignDefaultsResolver | undefined>(DESIGN_DEFAULTS_KEY);
  return () => (resolve?.()[component] ?? {}) as ComponentDefaults<C>;
}

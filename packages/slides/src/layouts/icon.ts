/**
 * Layout icons through the Texuli icon registry (UG-38). A host registers
 * names with `registerIcons` or `<IconsProvider>` from `texuli/icons`
 * (D-G-021); the registry lives in Svelte context under a plain string key,
 * so every copy of texuli shares it. `@texuli/slides` does not depend on
 * `texuli`, so it reads that same context here instead of importing the
 * `Icon` component; `tests/layouts.test.ts` mounts the real `IconsProvider`
 * to keep the two in step.
 */
import { type Component, getContext, hasContext } from 'svelte';

/** The registry's context key in `texuli/icons` (`components/icons/registry.ts`). */
const TEXULI_ICONS_CONTEXT = 'texuli.icons';

/** A registered glyph: a Svelte SVG component (such as a Lucide icon), or one 24×24 path `d`. */
// biome-ignore lint/suspicious/noExplicitAny: icon components take their own props
export type DeckIconGlyph = Component<any> | string;

/** Resolves an icon name from slide data to its registered glyph, or `undefined`. */
export type DeckIconLookup = (name: string | undefined) => DeckIconGlyph | undefined;

const NONE: DeckIconLookup = () => undefined;

/**
 * The icon lookup for a layout renderer (call during component init). It is
 * reactive: a lazy glyph (`() => import(…)`) resolves to `undefined` on the
 * server and on the first client render, then to its glyph once loaded.
 * Without a registry in context, every name resolves to `undefined`.
 */
export function useDeckIcons(): DeckIconLookup {
  if (!hasContext(TEXULI_ICONS_CONTEXT)) return NONE;
  const lookup = getContext<((name: string) => unknown) | undefined>(TEXULI_ICONS_CONTEXT);
  if (typeof lookup !== 'function') return NONE;
  return (name) => {
    if (!name) return undefined;
    const glyph = lookup(name);
    return typeof glyph === 'function' || (typeof glyph === 'string' && glyph.trim() !== '')
      ? (glyph as DeckIconGlyph)
      : undefined;
  };
}

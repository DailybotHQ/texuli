/**
 * Icon names an app registers (D-G-021). The registry lives in Svelte
 * context, not in a module global, so it is SSR-safe: one server render
 * never sees another request's icons, and two subtrees can register
 * different sets. A nested registration layers over the one above it (its
 * names win, the rest fall through).
 */
import { getContext, setContext } from 'svelte';
import type { IconGlyph, IconRegistry } from './types.ts';

/** The context key (a string, so package copies share it). */
const ICONS_KEY = 'texuli.icons';

/** Resolves a registered name to its glyph, or `undefined`. */
export type IconLookup = (name: string) => IconGlyph | undefined;

const NONE: IconLookup = () => undefined;

function isGlyph(value: unknown): value is IconGlyph {
  return typeof value === 'function' || (typeof value === 'string' && value.trim() !== '');
}

/**
 * Put a registry reader in context. `read` is called on every lookup, so a
 * reactive source (a provider prop) updates the icons below it in place.
 */
export function setIconsContext(read: () => IconRegistry): IconLookup {
  const parent = getContext<IconLookup | undefined>(ICONS_KEY) ?? NONE;
  const lookup: IconLookup = (name) => {
    const icons = read();
    if (Object.hasOwn(icons, name)) {
      const glyph = icons[name];
      if (isGlyph(glyph)) return glyph;
    }
    return parent(name);
  };
  setContext(ICONS_KEY, lookup);
  return lookup;
}

/**
 * Register icons by name for every `Icon` below this component:
 * `registerIcons({ rocket: Rocket, spark: 'M12 3v18M3 12h18' })`, then
 * `<Icon icon="rocket" />`. A value is a Svelte SVG component (Lucide icons
 * work as is) or one path `d` string on a 24×24 viewBox, drawn like the
 * built-ins. Call it in a component's script (the app root, a layout); it
 * uses Svelte context, so it is SSR-safe and scoped to that subtree.
 * Built-in names keep their own glyphs.
 */
export function registerIcons(icons: IconRegistry): void {
  setIconsContext(() => icons);
}

/** The registry lookup in context (call during component initialization). */
export function iconLookup(): IconLookup {
  return getContext<IconLookup | undefined>(ICONS_KEY) ?? NONE;
}

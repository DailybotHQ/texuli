/**
 * Icon names an app registers (D-G-021). The registry lives in Svelte
 * context, not in a module global, so it is SSR-safe: one server render
 * never sees another request's icons, and two subtrees can register
 * different sets. A nested registration layers over the one above it (its
 * names win, the rest fall through).
 *
 * Lazy loaders and the fallback live here, in `setIconsContext`, which only
 * `registerIcons` and `IconsProvider` (the `texuli/icons` subpath) call; the
 * root `Icon` reads a lookup and pays for neither.
 */
import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { iconPath, isIconName } from './icons.ts';
import type { IconGlyph, IconLoader, IconRegistry, IconRegistryOptions } from './types.ts';

/** The context key (a string, so package copies share it). */
const ICONS_KEY = 'texuli.icons';

/**
 * Resolves a registered name to its glyph, or `undefined`. `bare` skips the
 * fallback, so a nested registry asks its parent for real glyphs first.
 */
export type IconLookup = (name: string, bare?: boolean) => IconGlyph | undefined;

const NONE: IconLookup = () => undefined;

function isGlyph(value: unknown): value is IconGlyph {
  return typeof value === 'function' || (typeof value === 'string' && value.trim() !== '');
}

/** A loader takes no arguments; a Svelte component always takes its anchor. */
function isLoader(value: unknown): value is IconLoader {
  return typeof value === 'function' && value.length === 0;
}

/**
 * Put a registry reader in context. `read` is called on every lookup, so a
 * reactive source (a provider prop) updates the icons below it in place.
 */
export function setIconsContext(
  read: () => IconRegistry,
  fallback: () => IconRegistryOptions['fallback'] = () => undefined
): IconLookup {
  const parent = getContext<IconLookup | undefined>(ICONS_KEY) ?? NONE;
  // Loaded glyphs per loader, for this registry: a glyph, or `null` when the
  // loader failed. Reactive, so an `Icon` waiting on one redraws when it lands.
  const loaded = new SvelteMap<IconLoader, IconGlyph | null>();
  const started = new Set<IconLoader>();
  const load = (loader: IconLoader): IconGlyph | undefined => {
    // On the server nothing loads: the icon renders its fallback, as the
    // first client render does, so hydration matches.
    if (!started.has(loader) && typeof window !== 'undefined') {
      started.add(loader);
      const settle = (glyph: IconGlyph | null) => loaded.set(loader, glyph);
      // The executor catches a loader that throws instead of rejecting.
      new Promise<Awaited<ReturnType<IconLoader>>>((resolve) => resolve(loader())).then(
        (module) => {
          const glyph = typeof module === 'object' && module ? module.default : module;
          settle(isGlyph(glyph) && !isLoader(glyph) ? glyph : null);
        },
        () => settle(null)
      );
    }
    return loaded.get(loader) ?? undefined;
  };
  const lookup: IconLookup = (name, bare) => {
    const icons = read();
    const value = Object.hasOwn(icons, name) ? icons[name] : undefined;
    const glyph =
      (isLoader(value) ? load(value) : isGlyph(value) ? value : undefined) ?? parent(name, true);
    if (glyph || bare) return glyph;
    const own = fallback();
    if (!isGlyph(own)) return parent(name);
    return typeof own === 'string' && isIconName(own) ? iconPath(own) : own;
  };
  setContext(ICONS_KEY, lookup);
  return lookup;
}

/**
 * Register icons by name for every `Icon` below this component:
 * `registerIcons({ rocket: Rocket, spark: 'M12 3v18M3 12h18' })`, then
 * `<Icon icon="rocket" />`. A value is a Svelte SVG component (Lucide icons
 * work as is), one path `d` string on a 24×24 viewBox, drawn like the
 * built-ins, or a lazy loader (`() => import('@lucide/svelte/icons/rocket')`,
 * new in `0.14.0`). `options.fallback` draws unknown names and lazy icons
 * until they load. Call it in a component's script (the app root, a
 * layout); it uses Svelte context, so it is SSR-safe and scoped to that
 * subtree. Built-in names keep their own glyphs.
 */
export function registerIcons(icons: IconRegistry, options?: IconRegistryOptions): void {
  setIconsContext(
    () => icons,
    () => options?.fallback
  );
}

/** The registry lookup in context (call during component initialization). */
export function iconLookup(): IconLookup {
  return getContext<IconLookup | undefined>(ICONS_KEY) ?? NONE;
}

import type { Component } from 'svelte';
import type { SVGAttributes } from 'svelte/elements';

/**
 * Props accepted when rendering a custom/Lucide SVG icon component.
 *
 * Lucide's Svelte icons use `strokeWidth?: number | string` and `color?: string`
 * (not `string | null` from SVGAttributes). Component props are contravariant:
 * `Component<LucideProps>` is only assignable to `IconComponent` when our props
 * type is a subtype of Lucide's — so we omit SVG `color` and re-declare it as
 * `string`, and widen `strokeWidth` to `number | string`.
 */
export type IconComponentProps = Omit<SVGAttributes<SVGSVGElement>, 'color'> & {
  size?: number | string;
  /** Solid fill/stroke color; Lucide rejects `null`. */
  color?: string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  /** Lucide internal node tree (ignored by plain SVG components). */
  iconNode?: unknown[];
};

/** A Svelte SVG component, including any icon imported from `@lucide/svelte`. */
export type IconComponent = Component<IconComponentProps>;

export const ICON_NAMES = [
  'check',
  'chevron-down',
  'chevron-right',
  'close',
  'info',
  'menu',
  'minus',
  'plus',
  'search',
  'warning',
] as const;

/** One of the built-in icon names (`ICON_NAMES`). */
export type BuiltInIconName = (typeof ICON_NAMES)[number];

/**
 * The names an app registers with `registerIcons` or `IconsProvider`. Empty by
 * default; augment it so `<Icon icon>` autocompletes and checks them:
 *
 * ```ts
 * declare module 'texuli/icons' {
 *   interface IconNames {
 *     rocket: true;
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: an augmentation point, filled by apps.
export interface IconNames {}

/** A built-in icon name, or a name an app registered (and declared in `IconNames`). */
export type IconName = BuiltInIconName | Extract<keyof IconNames, string>;
export type IconRef = IconName | IconComponent;

/**
 * Glyph data for a registered name: a Svelte SVG component (such as a Lucide
 * icon), or the built-in shape, one path `d` string drawn stroked on a 24×24
 * viewBox. The path is rendered as a `<path d>` attribute, never as markup.
 */
export type IconGlyph = IconComponent | string;

/**
 * A lazy glyph (new in `0.14.0`): a function of no arguments that returns a
 * promise of a module whose default export is a glyph, or of a glyph:
 * `() => import('@lucide/svelte/icons/rocket')`. It runs once per registry,
 * in the browser, the first time an `Icon` asks for its name.
 */
export type IconLoader = () => Promise<IconGlyph | { readonly default: IconGlyph }>;

/** Names to glyphs or lazy loaders, as passed to `registerIcons` or `IconsProvider`. */
export type IconRegistry = Readonly<Record<string, IconGlyph | IconLoader>>;

/** Options for `registerIcons` (new in `0.14.0`). */
export interface IconRegistryOptions {
  /**
   * Drawn for a name this registry (or one above it) does not know, and for
   * a lazy icon until it loads or when it fails: a built-in icon name or a
   * glyph. Without one, those icons render nothing.
   */
  fallback?: BuiltInIconName | IconGlyph;
}
export type IconSize = 'xs' | 'sm' | 'md' | 'lg';

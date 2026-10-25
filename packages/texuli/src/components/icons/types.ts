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

export type IconName = (typeof ICON_NAMES)[number];
export type IconRef = IconName | IconComponent;
export type IconSize = 'xs' | 'sm' | 'md' | 'lg';

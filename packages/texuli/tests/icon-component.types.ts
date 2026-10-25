/**
 * Compile-time contract: Lucide-like Svelte icons must be assignable to
 * `IconComponent` (docs + Protoyard NavModel). Included by texuli tsconfig.
 */
import type { Component } from 'svelte';
import type { SVGAttributes } from 'svelte/elements';
import type { IconComponent, IconComponentProps } from '../src/components/icons/types.ts';

/** Mirrors `@lucide/svelte` icon props relevant to IconComponent. */
type LucideLikeProps = SVGAttributes<SVGSVGElement> & {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  iconNode?: unknown[];
};

type LucideLikeIcon = Component<LucideLikeProps>;

declare const lucideIcon: LucideLikeIcon;

// Must compile: a Lucide-like component is an IconComponent.
export const asIconComponent: IconComponent = lucideIcon;

// Must compile: IconComponentProps accepts Lucide strokeWidth string and color string.
export const lucidePropsOk: IconComponentProps = {
  size: 24,
  color: 'currentColor',
  strokeWidth: '1.5',
  absoluteStrokeWidth: true,
  iconNode: [],
};

// color?: string must not include null (Lucide narrows color to string).
type ColorProp = IconComponentProps['color'];
export type NullNotInColor = null extends ColorProp ? never : true;
const _nullColorGate: NullNotInColor = true;
void _nullColorGate;

// Prove the OLD contract would reject Lucide (document why we widened types).
// Old: strokeWidth?: number only; color from SVGAttributes as string | null.
type OldIconComponentProps = SVGAttributes<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
};
type OldIconComponent = Component<OldIconComponentProps>;

// @ts-expect-error Lucide-like Component is not assignable under the old props
export const lucideFailsOldContract: OldIconComponent = lucideIcon;

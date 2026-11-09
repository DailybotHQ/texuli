<script lang="ts">
/**
 * Box (ADR-032): a panel or region with padding, radius, border, elevation and surface
 * from the design system's tokens, the one way a locked prototype frames content without
 * visual utilities. Not interactive: use Card for a clickable surface. For an app header or
 * footer, use `radius="none"` with a single logical border side (`border="block-end"`).
 * `surface="canvas"` is the page background. `border="inline-start"` / `inline-end` mark a rail.
 */
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import {
  BOX_BORDERS,
  BOX_ELEMENTS,
  BOX_ELEVATIONS,
  BOX_PADDINGS,
  BOX_RADII,
  BOX_SURFACES,
  type BoxBorder,
  type BoxElement,
  type BoxElevation,
  type BoxPadding,
  type BoxRadius,
  type BoxSurface,
  boxClass,
  oneOf,
} from './variants.ts';

type Props = HTMLAttributes<HTMLElement> & {
  /** `div` (default), `section`, `article`, `aside`, `header` or `footer`. */
  as?: BoxElement;
  /** Space scale: `none`, `sm`, `md` (default), `lg`, `xl`. */
  padding?: BoxPadding;
  /** Shape radius: `none`, `sm`, `md` (default), `lg`, `xl`, `full`. */
  radius?: BoxRadius;
  /** `none` (default), `default` or `strong` (all sides), or one logical side: `block-start`, `block-end`, `inline-start`, `inline-end`. */
  border?: BoxBorder;
  /** Elevation shadow: `none` (default), `sm`, `md`, `lg`. */
  elevation?: BoxElevation;
  /** The fill: `transparent` (default), `default` (surface), `muted`, `subtle`, `elevated`, `canvas` (page background), `primary` (solid, with its on-color), `brand` (soft primary tint) or `translucent` (glass opacity and blur, for sticky headers). */
  surface?: BoxSurface;
  /** The rendered element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  as: asProp = 'div',
  padding: paddingProp = 'md',
  radius: radiusProp = 'md',
  border: borderProp = 'none',
  elevation: elevationProp = 'none',
  surface: surfaceProp = 'transparent',
  class: className,
  children,
  ...rest
}: Props = $props();

const as = $derived(oneOf(BOX_ELEMENTS, asProp, 'div'));
const padding = $derived(oneOf(BOX_PADDINGS, paddingProp, 'md'));
const radius = $derived(oneOf(BOX_RADII, radiusProp, 'md'));
const border = $derived(oneOf(BOX_BORDERS, borderProp, 'none'));
const elevation = $derived(oneOf(BOX_ELEVATIONS, elevationProp, 'none'));
const surface = $derived(oneOf(BOX_SURFACES, surfaceProp, 'transparent'));
</script>

<svelte:element
  this={as}
  bind:this={ref}
  {...rest}
  class={cx(boxClass({ padding, radius, border, elevation, surface }), className)}
  data-tx-component="box"
  data-tx-variant={surface}
>{@render children?.()}</svelte:element>

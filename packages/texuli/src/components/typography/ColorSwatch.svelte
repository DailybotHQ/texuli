<script lang="ts">
/**
 * ColorSwatch (ADR-032): a chip of a closed palette, role or data-viz color.
 * Fill and contrast ink come from `colorRefVar` / `colorRefInk`. A value that
 * is not a registered color name paints no fill (never free CSS).
 */
import type { HTMLAttributes } from 'svelte/elements';
import { colorRefInk, colorRefVar, isColorRef } from '../../internal/color-ref.ts';
import { cx } from '../../internal/cx.ts';
import { COLOR_SWATCH_SIZES, type ColorSwatchSize, oneOf } from './variants.ts';
import './typography.css';

type Props = HTMLAttributes<HTMLSpanElement> & {
  /** Closed color reference (chart-1…8 or a role). Invalid values drop the fill. */
  color?: unknown;
  /** `sm`, `md` (default) or `lg`. */
  size?: ColorSwatchSize;
  /** Plain-text label, rendered as escaped text; replaces `children` when non-empty. */
  label?: string;
  /** The rendered element (bindable). */
  ref?: HTMLSpanElement | null;
};

let {
  color,
  size: sizeProp = 'md',
  label,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const size = $derived(oneOf(COLOR_SWATCH_SIZES, sizeProp, 'md'));
const resolved = $derived(isColorRef(color) ? color : undefined);
const fill = $derived(resolved ? colorRefVar(resolved) : undefined);
const ink = $derived(resolved ? colorRefInk(resolved) : undefined);
const hasLabel = $derived(typeof label === 'string' && label.length > 0);
</script>

<span
  bind:this={ref}
  {...rest}
  class={cx('tx-color-swatch', `tx-color-swatch--${size}`, className)}
  style:--tx-swatch-fill={fill}
  style:--tx-swatch-ink={ink}
  data-tx-component="color-swatch"
  data-tx-variant={resolved}
  data-tx-size={size}
>{#if hasLabel}{label}{:else}{@render children?.()}{/if}</span>

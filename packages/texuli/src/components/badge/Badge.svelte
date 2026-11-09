<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { type BadgeVariant, badgeClass } from './variants.ts';
import './badge.css';
import {
  type CategoryColor,
  colorRefInk,
  colorRefVar,
  isCategoryColor,
} from '../../internal/color-ref.ts';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = HTMLAttributes<HTMLSpanElement> & {
  /** Semantic fill. Filled pairs use token foregrounds for AA on small text. */
  variant?: BadgeVariant;
  /** Closed data-viz category color; `none` preserves the variant appearance. */
  color?: CategoryColor;
  /**
   * Plain-text label, rendered as escaped text. A non-empty `label`
   * replaces `children` when both are given.
   */
  label?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

const txDefaults = designDefaults('badge');
let {
  ref = $bindable(null),
  variant = txDefaults().variant ?? 'default',
  color = 'none',
  label,
  class: className,
  children,
  ...rest
}: Props = $props();

const hasLabel = $derived(typeof label === 'string' && label.length > 0);
const categoryColor = $derived(isCategoryColor(color) && color !== 'none' ? color : undefined);
</script>

<span bind:this={ref} class={badgeClass({ variant, class: className })} data-tx-badge data-variant={variant} {...rest}
   data-tx-component="badge" data-tx-variant={variant} data-tx-color={categoryColor}
   style:--tx-category-fill={categoryColor ? colorRefVar(categoryColor) : undefined}
   style:--tx-category-ink={categoryColor ? colorRefInk(categoryColor) : undefined}>{#if hasLabel}{label}{:else}{@render children?.()}{/if}</span
>

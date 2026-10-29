<script lang="ts">
import { Content as PrimitiveContent } from '@texuli/primitives/popover';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import {
  type PopoverSize,
  type PopoverVariant,
  popoverArrowClass,
  popoverContentClass,
} from './variants.ts';
import './popover.css';

type Props = ComponentProps<typeof PrimitiveContent> & {
  children?: Snippet;
  class?: ClassValue;
  variant?: PopoverVariant;
  size?: PopoverSize;
  /** Show the decorative arrow (default true). */
  arrow?: boolean;
  /** Accessible name when content has no visible heading. */
  'aria-label'?: string;
};

let {
  children,
  class: className,
  variant = 'elevated',
  size = 'md',
  arrow = true,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(
  popoverContentClass({
    variant,
    size,
    class: className,
  })
);
</script>

<PrimitiveContent bind:ref
  class={classes}
  data-tx-popover-content
  data-variant={variant}
  data-size={size}
  {...rest}
>
  {#if arrow}
    <span class={popoverArrowClass()} data-tx-popover-arrow aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</PrimitiveContent>

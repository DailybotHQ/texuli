<script lang="ts">
import { HoverCardContent as PrimitiveContent } from '@texuli/primitives/hover-card';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import {
  hoverCardArrowClass,
  hoverCardContentClass,
  type PopoverSize,
  type PopoverVariant,
} from './variants.ts';
import './popover.css';

type Props = ComponentProps<typeof PrimitiveContent> & {
  children?: Snippet;
  class?: ClassValue;
  variant?: PopoverVariant;
  size?: PopoverSize;
  arrow?: boolean;
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
  hoverCardContentClass({
    variant,
    size,
    class: className,
  })
);
</script>

<PrimitiveContent bind:ref
  class={classes}
  data-tx-hover-card-content
  data-variant={variant}
  data-size={size}
  {...rest}
>
  {#if arrow}
    <span class={hoverCardArrowClass()} data-tx-hover-card-arrow aria-hidden="true"></span>
  {/if}
  {@render children?.()}
</PrimitiveContent>

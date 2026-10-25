<script lang="ts">
import {
  type ScrollAreaDir,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  type ScrollAreaType,
  ScrollAreaViewport,
} from '@texuli/primitives/scroll-area';
import type { Snippet } from 'svelte';
import { cx } from '../../internal/cx.ts';
import type { ScrollAreaProps } from './props.ts';
import { type ScrollAreaSize, scrollAreaVariants } from './variants.ts';
import './scroll-area.css';

let {
  label,
  type = 'auto',
  dir = 'ltr',
  size = 'md',
  class: className,
  children,
  ...attributes
}: ScrollAreaProps = $props();

const rootClass = $derived(cx(scrollAreaVariants({ size }), className));
</script>

<ScrollAreaRoot {type} {dir} class={rootClass} role="region" aria-label={label} {...attributes}>
  <ScrollAreaViewport class="tx-scroll-area__viewport">
    {@render children?.()}
  </ScrollAreaViewport>
  <ScrollAreaScrollbar orientation="vertical" class="tx-scroll-area__scrollbar">
    <ScrollAreaThumb class="tx-scroll-area__thumb" />
  </ScrollAreaScrollbar>
</ScrollAreaRoot>

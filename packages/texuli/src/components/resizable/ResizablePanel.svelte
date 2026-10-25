<script lang="ts">
import { Splitter } from '@texuli/primitives/splitter';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { resizablePanelClass } from './variants.ts';

/**
 * One panel. Sizes are percent of the group; padding belongs on the content
 * inside, because a collapsed panel keeps its own padding.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> & {
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  collapsedSize?: number;
  onCollapse?: () => void;
  onExpand?: () => void;
  class?: ClassValue;
  ref?: HTMLElement | null;
  children?: Snippet;
};

let { class: className, ref = $bindable(null), children, ...rest }: Props = $props();
</script>

<Splitter.Pane {...rest} bind:ref class={resizablePanelClass({ class: className })}>
  {@render children?.()}
</Splitter.Pane>

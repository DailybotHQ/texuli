<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ToolbarOrientation, toolbarContext } from './context.ts';
import { attachToolbarRovingFocus } from './roving.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children'> & {
  /** Default `horizontal` (left and right arrows); `vertical` uses up and down. */
  orientation?: ToolbarOrientation;
  /** Arrows wrap from the last item to the first. Default `true`. */
  loop?: boolean;
  ref?: HTMLElement | null;
  children?: Snippet;
};

let {
  orientation = 'horizontal',
  loop = true,
  ref = $bindable(null),
  children,
  ...rest
}: Props = $props();

toolbarContext.set({
  get orientation() {
    return orientation;
  },
});

// One Tab stop for the whole toolbar; arrows (mirrored right to left), Home and
// End move among its items. Disabled items stay focusable so users find them.
const roving = $derived(attachToolbarRovingFocus(orientation, loop));
</script>

<div
  bind:this={ref}
  {...rest}
  role="toolbar"
  aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
  data-orientation={orientation}
  data-toolbar-root=""
  {@attach roving}
>
  {@render children?.()}
</div>

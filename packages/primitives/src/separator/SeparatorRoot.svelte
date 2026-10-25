<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/index.ts';
import {
  type SeparatorAttributes,
  type SeparatorOrientation,
  separatorAttributes,
} from './attributes.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'children'> & {
  /** Default `horizontal`. */
  orientation?: SeparatorOrientation;
  /** Visual only, hidden from assistive technology. Default `false`. */
  decorative?: boolean;
  /** The rendered element (bindable). */
  ref?: HTMLElement | null;
  /** Render your own element: spread `props` on its root. */
  child?: ChildSnippet<SeparatorAttributes & Record<string, unknown>>;
};

let {
  orientation = 'horizontal',
  decorative = false,
  ref = $bindable(null),
  child,
  ...rest
}: Props = $props();

// Role and orientation are the separator's: a consumer attribute never overrides them.
const attrs = $derived.by(() => {
  const own = separatorAttributes({ orientation, decorative });
  return { ...rest, ...own, 'aria-orientation': own['aria-orientation'] };
});
</script>

{#if child}
  {@render child({ props: attrs })}
{:else}
  <div bind:this={ref} {...attrs}></div>
{/if}

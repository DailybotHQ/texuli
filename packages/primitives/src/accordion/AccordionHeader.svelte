<script lang="ts">
import { itemContext, partAttributes } from './context.ts';
import type { AccordionHeaderProps } from './types.ts';

let { level = 3, child, children, ref = $bindable(null), ...rest }: AccordionHeaderProps = $props();

const item = itemContext.get();
const tag = $derived(`h${Math.min(6, Math.max(1, Math.trunc(level) || 3))}`);
const partProps = $derived({
  ...rest,
  ...partAttributes(item),
});
</script>

{#if child}
  <!-- A custom element keeps the heading semantics through role and aria-level. -->
  {@render child({ props: { ...partProps, role: 'heading', 'aria-level': Number(tag.slice(1)) } })}
{:else}
  <svelte:element this={tag} bind:this={ref} {...partProps}>{@render children?.()}</svelte:element>
{/if}

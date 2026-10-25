<script lang="ts">
import { tagsInputContext } from './context.ts';
import type { TagsInputListProps } from './types.ts';

/** The list of tags (`role="list"`, so screen readers announce how many there are). */
let { child, children, ref = $bindable(null), ...rest }: TagsInputListProps = $props();

const tagsInput = tagsInputContext.get();
const partProps = $derived({
  ...rest,
  role: 'list',
  'data-disabled': tagsInput.disabled ? '' : undefined,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <ul bind:this={ref} {...partProps}>{@render children?.()}</ul>
{/if}

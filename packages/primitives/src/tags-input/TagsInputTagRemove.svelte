<script lang="ts">
import { tagsInputContext } from './context.ts';
import type { TagsInputTagRemoveProps } from './types.ts';

/**
 * The tag's remove button, for pointer and touch (keyboard users press
 * Backspace or Delete on the tag, so it is not a Tab stop). Named
 * "Remove <tag>" by default.
 */
let {
  index,
  child,
  children,
  ref = $bindable(null),
  onclick,
  ...rest
}: TagsInputTagRemoveProps = $props();

const tagsInput = tagsInputContext.get();

function handleClick(event: MouseEvent) {
  (onclick as ((e: MouseEvent) => void) | undefined)?.(event);
  if (!event.defaultPrevented) tagsInput.remove(index, 'input');
}

const partProps = $derived({
  'aria-label': tagsInput.labels.remove(tagsInput.tags[index] ?? ''),
  ...rest,
  type: 'button' as const,
  tabindex: -1,
  disabled: tagsInput.disabled || tagsInput.readonly || undefined,
  onclick: handleClick,
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <button bind:this={ref} {...partProps}>{@render children?.()}</button>
{/if}

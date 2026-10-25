<script lang="ts">
import { isRtl, tagsInputContext } from './context.ts';
import type { TagsInputTagProps } from './types.ts';

/**
 * One tag: a list item that takes focus from the arrow keys (it is not a Tab
 * stop). Backspace removes it and moves to the previous tag, Delete to the
 * next one; ArrowLeft and ArrowRight move between tags (flipped in RTL) and
 * ArrowRight past the last tag returns to the input.
 */
let {
  index,
  child,
  children,
  ref = $bindable(null),
  onkeydown,
  ...rest
}: TagsInputTagProps = $props();

const tagsInput = tagsInputContext.get();
let focused = $state(false);

function handleKeydown(event: KeyboardEvent) {
  (onkeydown as ((e: KeyboardEvent) => void) | undefined)?.(event);
  if (event.defaultPrevented || event.target !== event.currentTarget) return;
  const node = event.currentTarget as HTMLElement;
  const rtl = isRtl(node);
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const last = tagsInput.tags.length - 1;
  if (event.key === 'Backspace' || event.key === 'Delete') {
    tagsInput.remove(index, event.key === 'Backspace' ? 'previous' : 'next');
  } else if (event.key === back) {
    if (index > 0) tagsInput.focusTag(index - 1);
  } else if (event.key === forward) {
    if (index < last) tagsInput.focusTag(index + 1);
    else tagsInput.focusInput();
  } else if (event.key === 'Home') tagsInput.focusTag(0);
  else if (event.key === 'End') tagsInput.focusInput();
  else return;
  event.preventDefault();
}

const partProps = $derived({
  ...rest,
  tabindex: -1,
  'data-tx-tags-input-tag': '',
  'data-index': index,
  'data-state': focused ? 'active' : 'inactive',
  'data-disabled': tagsInput.disabled ? '' : undefined,
  onkeydown: handleKeydown,
  onfocus: () => {
    focused = true;
  },
  onblur: () => {
    focused = false;
  },
});
</script>

{#if child}
  {@render child({ props: partProps })}
{:else}
  <li bind:this={ref} {...partProps}>{@render children?.()}</li>
{/if}

<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/index.ts';
import { disabledAttributes, TOOLBAR_ITEM } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  /** Disabled but still focusable (`aria-disabled`): clicks do nothing. */
  disabled?: boolean;
  ref?: HTMLElement | null;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let {
  disabled = false,
  ref = $bindable(null),
  child,
  children,
  onclick,
  ...rest
}: Props = $props();

const attrs = $derived({
  ...rest,
  type: 'button' as const,
  [TOOLBAR_ITEM]: '',
  tabindex: -1,
  ...disabledAttributes(disabled),
  onclick: (event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => {
    if (disabled) event.preventDefault();
    else onclick?.(event);
  },
});
</script>

{#if child}
  {@render child({ props: composeChildProps(attrs, {}) })}
{:else}
  <button bind:this={ref} {...attrs}>{@render children?.()}</button>
{/if}

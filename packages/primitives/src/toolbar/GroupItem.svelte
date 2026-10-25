<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/index.ts';
import { disabledAttributes, TOOLBAR_ITEM, toolbarGroupContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children' | 'value'> & {
  value: string;
  disabled?: boolean;
  ref?: HTMLElement | null;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let { value, disabled = false, ref = $bindable(null), child, children, ...rest }: Props = $props();

const group = toolbarGroupContext.get();
const pressed = $derived(group.isPressed(value));
const off = $derived(disabled || group.disabled);

// In a single group the items are radios (aria-checked); in a multiple group,
// toggle buttons (aria-pressed). Space and Enter press them like any button.
const attrs = $derived({
  ...rest,
  type: 'button' as const,
  role: group.type === 'single' ? ('radio' as const) : undefined,
  'aria-checked': group.type === 'single' ? pressed : undefined,
  'aria-pressed': group.type === 'multiple' ? pressed : undefined,
  'data-state': pressed ? 'on' : 'off',
  'data-value': value,
  [TOOLBAR_ITEM]: '',
  tabindex: -1,
  ...disabledAttributes(off),
  onclick: (event: MouseEvent) => {
    rest.onclick?.(event as MouseEvent & { currentTarget: EventTarget & HTMLButtonElement });
    if (!event.defaultPrevented && !off) group.toggle(value);
  },
});
</script>

{#if child}
  {@render child({ props: composeChildProps(attrs, {}) })}
{:else}
  <button bind:this={ref} {...attrs}>{@render children?.()}</button>
{/if}

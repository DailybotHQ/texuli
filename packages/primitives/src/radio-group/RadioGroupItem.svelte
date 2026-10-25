<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { stateAttributes } from '../internal/state.ts';
import { radioGroupContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'value' | 'disabled' | 'children'> & {
  value: string;
  disabled?: boolean | null;
  id?: string;
  class?: string;
  children?: Snippet<[{ checked: boolean }]>;
};

let { value, disabled = false, id, class: className, children, ...rest }: Props = $props();

const group = radioGroupContext.get();

const itemDisabled = $derived(Boolean(disabled) || group.disabled());
const checked = $derived(group.value() === value);
const attrs = $derived(stateAttributes(checked ? 'checked' : 'unchecked', itemDisabled));

let buttonEl = $state<HTMLButtonElement | null>(null);

$effect(() => {
  if (!buttonEl) return;
  return group.registerItem({ value, element: buttonEl, disabled: itemDisabled });
});

function onSelect(): void {
  if (itemDisabled || group.readonly()) return;
  group.select(value);
}

function onKeydown(event: KeyboardEvent): void {
  if (itemDisabled || group.readonly()) return;
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    onSelect();
  }
}
</script>

<button
  bind:this={buttonEl}
  type="button"
  role="radio"
  {id}
  class={className}
  {value}
  aria-checked={checked}
  data-tx-radio-item=""
  data-value={value}
  data-state={attrs['data-state']}
  data-disabled={attrs['data-disabled']}
  disabled={itemDisabled || undefined}
  tabindex={checked ? 0 : -1}
  onclick={(event) => {
    if (event.defaultPrevented) return;
    onSelect();
  }}
  onkeydown={(event) => {
    if (event.defaultPrevented) return;
    onKeydown(event);
  }}
  {...rest}
>
  {#if children}
    {@render children({ checked })}
  {/if}
</button>

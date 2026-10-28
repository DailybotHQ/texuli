<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { composeHandlers } from '../internal/handlers.ts';
import { stateAttributes } from '../internal/state.ts';
import { tabsContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'value' | 'disabled' | 'children'> & {
  value: string;
  disabled?: boolean | null;
  class?: string;
  children?: Snippet;
};

let {
  value,
  disabled = false,
  class: className,
  children,
  onclick,
  onkeydown,
  ...rest
}: Props = $props();

const tabs = tabsContext.get();
// A consumer id wins: the context records it, so every reference follows.
tabs.claimId(
  'trigger',
  untrack(() => value),
  untrack(() => rest.id)
);
$effect(() => {
  const item = value;
  tabs.claimId('trigger', item, rest.id);
  return () => tabs.claimId('trigger', item, undefined);
});

const itemDisabled = $derived(Boolean(disabled) || tabs.disabled());
const selected = $derived(tabs.value() === value);
const attrs = $derived(stateAttributes(selected ? 'active' : 'inactive', itemDisabled));
const id = $derived(tabs.triggerId(value));
const controls = $derived(tabs.contentId(value));

let buttonEl = $state<HTMLButtonElement | null>(null);

$effect(() => {
  if (!buttonEl) return;
  return tabs.registerTrigger({ value, element: buttonEl, disabled: itemDisabled });
});

function activate(): void {
  if (itemDisabled) return;
  tabs.select(value);
}

function onKeydown(event: KeyboardEvent): void {
  if (itemDisabled) return;
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    activate();
  }
}
</script>

<button
  bind:this={buttonEl}
  type="button"
  role="tab"
  {id}
  class={className}
  data-tx-tabs-trigger=""
  data-value={value}
  data-state={attrs['data-state']}
  data-disabled={attrs['data-disabled']}
  aria-selected={selected}
  aria-controls={controls}
  disabled={itemDisabled || undefined}
  tabindex={selected ? 0 : -1}
  {...rest}
  onclick={composeHandlers(onclick, activate)}
  onkeydown={composeHandlers(onkeydown, onKeydown)}
>
  {@render children?.()}
</button>

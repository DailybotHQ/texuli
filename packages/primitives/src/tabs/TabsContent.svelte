<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { stateAttributes } from '../internal/state.ts';
import { tabsContext } from './context.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  value: string;
  /** When true, inactive panels stay mounted but hidden (default). */
  forceMount?: boolean;
  class?: string;
  children?: Snippet;
} & RefProp;

let {
  value,
  forceMount = true,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const tabs = tabsContext.get();
const selected = $derived(tabs.value() === value);
const shouldRender = $derived(forceMount || selected);
// A consumer id wins: the context records it, so every reference follows.
// Only a rendered panel claims, so a tab never points at a missing one.
const claim = () => (shouldRender ? (rest.id ?? '') : undefined);
tabs.claimId(
  'content',
  untrack(() => value),
  untrack(claim)
);
$effect(() => {
  const item = value;
  tabs.claimId('content', item, claim());
  return () => tabs.claimId('content', item, undefined);
});

const attrs = $derived(stateAttributes(selected ? 'active' : 'inactive'));
const id = $derived(tabs.contentId(value));
const labelledBy = $derived(tabs.triggerId(value));
</script>

{#if shouldRender}
  <div bind:this={ref}
    role="tabpanel"
    {id}
    class={className}
    data-tx-tabs-content=""
    data-value={value}
    data-state={attrs['data-state']}
    aria-labelledby={labelledBy}
    hidden={!selected}
    tabindex={selected ? 0 : -1}
    {...rest}
  >
    {@render children?.()}
  </div>
{/if}

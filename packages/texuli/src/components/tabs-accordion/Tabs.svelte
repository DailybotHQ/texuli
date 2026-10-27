<script lang="ts">
import { Tabs as TabsPrimitive } from '@texuli/primitives/tabs';
import type { Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import type { TabItem } from './types.ts';
import {
  type TabsOrientation,
  type TabsVariant,
  tabsListClass,
  tabsRootClass,
  tabsTriggerClass,
} from './variants.ts';
import './tabs-accordion.css';

type Props = {
  items: readonly TabItem[];
  value?: string;
  onValueChange?: (value: string) => void;
  /** Accessible name for the tab list. */
  label?: string;
  variant?: TabsVariant;
  orientation?: TabsOrientation;
  activationMode?: 'automatic' | 'manual';
  /** Wrap arrow-key focus past the first/last tab (APG optional wrapping). */
  loop?: boolean;
  disabled?: boolean;
  class?: ClassValue;
  listClass?: string;
  /** Renders the panel body for each item. */
  content?: Snippet<[TabItem]>;
  children?: Snippet;
};

let {
  items,
  value = $bindable(''),
  onValueChange,
  label,
  variant = 'line',
  orientation = 'horizontal',
  activationMode = 'automatic',
  loop = false,
  disabled = false,
  class: className,
  listClass,
  content,
  children,
}: Props = $props();

$effect.pre(() => {
  if (value === undefined || value === '') {
    value = items.find((item) => !item.disabled)?.value ?? '';
  }
});

const rootClass = $derived(
  tabsRootClass({
    orientation,
    variant,
    class: className,
  })
);
const listClassName = $derived(
  tabsListClass({
    variant,
    class: typeof listClass === 'string' ? listClass : undefined,
  })
);
const triggerClass = $derived(tabsTriggerClass({ variant }));
</script>

<TabsPrimitive.Root
  bind:value
  {onValueChange}
  {orientation}
  {activationMode}
  {loop}
  {disabled}
  class={rootClass}
  data-tx-tabs=""
  data-variant={variant}
>
  <div class="tx-tabs__scroller">
    <TabsPrimitive.List class={listClassName} aria-label={label} data-tx-tabs-list="">
      {#each items as item (item.value)}
        <TabsPrimitive.Trigger
          value={item.value}
          disabled={item.disabled}
          class={triggerClass}
          data-tx-tabs-trigger=""
        >
          {item.label}
          {#if item.badge !== undefined}
            <span class="tx-tabs__badge" aria-hidden="true">{item.badge}</span>
          {/if}
        </TabsPrimitive.Trigger>
      {/each}
    </TabsPrimitive.List>
  </div>

  {#if content}
    {#each items as item (item.value)}
      <TabsPrimitive.Content value={item.value} class="tx-tabs__panel" data-tx-tabs-panel="">
        {@render content(item)}
      </TabsPrimitive.Content>
    {/each}
  {/if}
  {@render children?.()}
</TabsPrimitive.Root>

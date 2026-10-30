<script lang="ts">
import { Tabs as TabsPrimitive } from '@texuli/primitives/tabs';
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { MotionProp } from '../../motion/contract.ts';
import { createIndicatorMotion } from '../../motion/seam.ts';
import { Icon } from '../icons/index.ts';
import type { TabItem } from './types.ts';
import {
  type TabsOrientation,
  type TabsVariant,
  tabsListClass,
  tabsRootClass,
  tabsTriggerClass,
} from './variants.ts';
import './tabs-accordion.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type OwnProps = {
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
  /**
   * Motion (`texuli/motion`): the active indicator glides to the new tab
   * (`layout`, default on); `false` for none.
   */
  motion?: MotionProp;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

/** Extra attributes (`data-*`, `aria-*`, `id`, handlers…) land on the root element. */
type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps>;

let {
  items,
  value = $bindable(''),
  onValueChange,
  label,
  variant: variantProp,
  orientation = 'horizontal',
  activationMode = 'automatic',
  loop = false,
  disabled = false,
  class: className,
  listClass,
  content,
  children,
  motion,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('tabs');
const variant = $derived(withDefault(variantProp, txDefaults().variant, 'line'));

const indicatorMotion = createIndicatorMotion({
  motion: () => motion,
  defaults: { layout: true, duration: 'base' },
});
let listElement = $state<HTMLElement | null>(null);
let previousTab: Element | null = null;
let indicatorReady = false;
const activeTab = () =>
  listElement?.querySelector(':scope > [role="tab"][data-state="active"]') ?? null;
// Before the change: remember the active tab. After it: glide from there.
// The first run (mount and hydration) only records it.
$effect.pre(() => {
  void value;
  untrack(() => {
    previousTab = activeTab();
  });
});
$effect(() => {
  void value;
  untrack(() => {
    const next = activeTab();
    const from = previousTab;
    previousTab = next;
    if (!indicatorReady) {
      indicatorReady = true;
      return;
    }
    if (!listElement || !from || !next || from === next) return;
    const shape =
      variant !== 'line' ? 'fill' : orientation === 'vertical' ? 'inline-end' : 'block-end';
    indicatorMotion.glide(listElement, from, next, shape);
  });
});

function bindRef(node: HTMLElement): () => void {
  ref = node;
  return () => {
    if (ref === node) ref = null;
  };
}

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
  {...rest}
  bind:value
  {onValueChange}
  {orientation}
  {activationMode}
  {loop}
  {disabled}
  class={rootClass}
  data-tx-tabs=""
  data-variant={variant}
  {@attach bindRef}
>
  <div class="tx-tabs__scroller">
    <TabsPrimitive.List
      bind:ref={listElement}
      class={listClassName}
      aria-label={label}
      data-tx-tabs-list=""
    >
      {#each items as item (item.value)}
        <TabsPrimitive.Trigger
          value={item.value}
          disabled={item.disabled}
          class={triggerClass}
          data-tx-tabs-trigger=""
        >
          {#if item.icon}
            <Icon icon={item.icon} size="sm" class="tx-tabs__icon" data-tx-tabs-icon="" />
          {/if}
          {item.label}
          {#if item.badge !== undefined}
            <span class="tx-tabs__badge" aria-hidden="true">{item.badge}</span>
            <span class="tx-tabs__sr-only">&#32;{item.badgeLabel ?? item.badge}</span>
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

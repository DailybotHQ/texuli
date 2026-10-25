<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['line', 'pills', 'enclosed'],
      default: 'line',
    },
    {
      kind: 'enum',
      name: 'orientation',
      label: 'orientation',
      options: ['horizontal', 'vertical'],
      default: 'horizontal',
    },
    {
      kind: 'enum',
      name: 'activationMode',
      label: 'activationMode',
      options: ['automatic', 'manual'],
      default: 'automatic',
    },
    { kind: 'boolean', name: 'loop', label: 'loop', default: false },
  ],
  keys: [
    { keys: ['ArrowRight', 'ArrowLeft'], action: 'Move between tabs in a horizontal list' },
    { keys: ['ArrowDown', 'ArrowUp'], action: 'Move between tabs in a vertical list' },
    { keys: ['Home', 'End'], action: 'Move to the first or last tab' },
    { keys: ['Enter', ' '], action: 'Show the focused tab (manual activation)' },
  ],
  uncontrolled:
    'A plain value (no binding) selects "Overview" first; the tabs keep their own state.',
  controlled: 'bind:value keeps the selected tab in your state, so buttons outside can switch it.',
  code: (v) => `<script lang="ts">
  import { Tabs } from '@texuli/primitives/tabs';
  let value = $state('overview');
${SCRIPT_END}

<Tabs.Root bind:value${attr('orientation', String(v.orientation), 'horizontal')}${attr('activationMode', String(v.activationMode), 'automatic')}${attr('loop', v.loop === true, false)}>
  <Tabs.List aria-label="Project">
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="overview">…</Tabs.Content>
  <Tabs.Content value="activity">…</Tabs.Content>
  <Tabs.Content value="settings">…</Tabs.Content>
</Tabs.Root>
${recipeLine('tabsRootClass', 'texuli/tabs-accordion', { orientation: String(v.orientation), variant: String(v.variant) })}`,
  keyCheck: {
    focus: '[data-demo-part="Tabs.Trigger"][data-value="overview"]',
    press: 'End',
    expect: {
      selector: '[data-demo-part="Tabs.Trigger"][data-value="settings"]',
      attribute: 'aria-selected',
      value: 'true',
    },
  },
  controlCheck: {
    act: '[data-demo-act="activity"]',
    expect: {
      selector: '[data-demo-part="Tabs.Trigger"][data-value="activity"]',
      attribute: 'aria-selected',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { Tabs } from '@texuli/primitives/tabs';
import { Button } from 'texuli/button';
import { tabsListClass, tabsRootClass, tabsTriggerClass } from 'texuli/tabs-accordion';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const TABS = [
  { value: 'overview', label: 'Overview', body: 'Harbor Notes ships its next release on Friday.' },
  { value: 'activity', label: 'Activity', body: 'ada@example.com closed three tasks today.' },
  { value: 'settings', label: 'Settings', body: 'Notifications go to team@example.com.' },
];

const variant = $derived(
  (['line', 'pills', 'enclosed'] as const).find((entry) => entry === str(values, 'variant')) ?? 'line'
);
const orientation = $derived(str(values, 'orientation') === 'vertical' ? 'vertical' : 'horizontal');
const activationMode = $derived(str(values, 'activationMode') === 'manual' ? 'manual' : 'automatic');
const loop = $derived(bool(values, 'loop'));
const rootClass = $derived(tabsRootClass({ orientation, variant }));
const listClass = $derived(tabsListClass({ variant }));
const triggerClass = $derived(tabsTriggerClass({ variant }));

let value = $state('overview');
</script>

{#snippet body()}
  <div class="tx-tabs__scroller">
    <Tabs.List class={listClass} aria-label="Project" data-tx-tabs-list="" data-demo-part="Tabs.List">
      {#each TABS as tab (tab.value)}
        <Tabs.Trigger value={tab.value} class={triggerClass} data-tx-tabs-trigger="" data-demo-part="Tabs.Trigger" data-value={tab.value}>
          {tab.label}
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
  </div>
  {#each TABS as tab (tab.value)}
    <Tabs.Content value={tab.value} class="tx-tabs__panel" data-tx-tabs-panel="" data-demo-part="Tabs.Content">
      <p>{tab.body}</p>
    </Tabs.Content>
  {/each}
{/snippet}

{#key `${orientation}-${loop}`}
  {#if mode === 'uncontrolled'}
    <Tabs.Root value="overview" {orientation} {activationMode} {loop} class={rootClass} data-tx-tabs="" data-variant={variant} data-demo-part="Tabs.Root">
      {@render body()}
    </Tabs.Root>
  {:else}
    <Tabs.Root bind:value {orientation} {activationMode} {loop} class={rootClass} data-tx-tabs="" data-variant={variant} data-demo-part="Tabs.Root">
      {@render body()}
    </Tabs.Root>
  {/if}
{/key}

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>value: {value}</output>
    <Button size="sm" variant="outline" onclick={() => (value = 'activity')} data-demo-act="activity">Show Activity</Button>
    <Button size="sm" variant="ghost" onclick={() => (value = 'overview')}>Back to Overview</Button>
  </div>
{/if}

<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'side',
      label: 'side',
      options: ['top', 'right', 'bottom', 'left'],
      default: 'bottom',
    },
    {
      kind: 'enum',
      name: 'align',
      label: 'align',
      options: ['start', 'center', 'end'],
      default: 'center',
    },
    { kind: 'boolean', name: 'modal', label: 'modal', default: false },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['elevated', 'flat'],
      default: 'elevated',
    },
  ],
  keys: [
    { keys: ['Enter', ' '], action: 'Open or close from the trigger' },
    { keys: ['Escape'], action: 'Close and return focus to the trigger' },
    { keys: ['Tab'], action: 'Move through the panel (a modal popover keeps focus inside)' },
  ],
  uncontrolled: 'No binding: the trigger opens the panel and the popover keeps its own open state.',
  controlled: 'bind:open keeps the open state in your state, so a button outside can open it.',
  code: (v) => `<script lang="ts">
  import * as Popover from '@texuli/primitives/popover';
  let open = $state(false);
${SCRIPT_END}

<Popover.Root bind:open${attr('side', String(v.side), 'bottom')}${attr('align', String(v.align), 'center')}${attr('modal', v.modal === true, false)}>
  <Popover.Trigger>Filters</Popover.Trigger>
  <Popover.Content aria-label="Filter tasks">
    <label><input type="checkbox" /> Assigned to me</label>
    <Popover.Close>Apply</Popover.Close>
  </Popover.Content>
</Popover.Root>
${recipeLine('popoverContentClass', 'texuli/popover', { variant: String(v.variant) })}`,
  keyCheck: {
    open: '[data-demo-part="Trigger"]',
    focus: '[data-demo-part="Close"]',
    press: 'Escape',
    expect: { selector: '[data-demo-part="Content"]', count: 0 },
  },
  controlCheck: {
    act: '[data-demo-act="open"]',
    expect: { selector: '[data-demo-part="Content"]', attribute: 'data-state', value: 'open' },
  },
};
</script>

<script lang="ts">
import * as Popover from '@texuli/primitives/popover';
import { Button } from 'texuli/button';
import {
  popoverArrowClass,
  popoverCloseClass,
  popoverContentClass,
  popoverTriggerClass,
} from 'texuli/popover';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const ALIGNS = ['start', 'center', 'end'] as const;
const side = $derived(SIDES.find((entry) => entry === str(values, 'side')) ?? 'bottom');
const align = $derived(ALIGNS.find((entry) => entry === str(values, 'align')) ?? 'center');
const modal = $derived(bool(values, 'modal'));
const variant = $derived(str(values, 'variant', 'elevated') === 'flat' ? 'flat' : 'elevated');
const contentClass = $derived(popoverContentClass({ variant }));

let open = $state(false);
let mine = $state(true);
</script>

{#snippet panel()}
  <Popover.Trigger class={popoverTriggerClass()} data-tx-popover-trigger="" data-demo-part="Trigger">Filters</Popover.Trigger>
  <Popover.Content class={contentClass} data-tx-popover-content="" data-variant={variant} data-size="md" aria-label="Filter tasks" data-demo-part="Content">
    <span class={popoverArrowClass()} data-tx-popover-arrow="" aria-hidden="true"></span>
    <div class="demo-popover">
      <label class="demo-popover__row"><input type="checkbox" bind:checked={mine} /> Assigned to me</label>
      <Popover.Close class={popoverCloseClass()} data-tx-popover-close="" data-demo-part="Close">Apply</Popover.Close>
    </div>
  </Popover.Content>
{/snippet}

{#key modal}
  {#if mode === 'uncontrolled'}
    <Popover.Root {side} {align} {modal}>
      {@render panel()}
    </Popover.Root>
  {:else}
    <Popover.Root bind:open {side} {align} {modal}>
      {@render panel()}
    </Popover.Root>
  {/if}
{/key}
{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>open: {open}</output>
    <Button size="sm" variant="outline" onclick={() => (open = true)} data-demo-act="open">Open filters</Button>
  </div>
{/if}

<style>
  .demo-popover {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
  }
  .demo-popover__row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>

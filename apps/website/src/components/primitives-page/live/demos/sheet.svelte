<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'side',
      label: 'side',
      options: ['start', 'end', 'top', 'bottom'],
      default: 'start',
    },
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'sm' },
    { kind: 'boolean', name: 'modal', label: 'modal', default: true },
  ],
  keys: [
    { keys: ['Enter', ' '], action: 'Open the sheet from its trigger' },
    { keys: ['Tab'], action: 'Move through the sheet (focus stays inside while modal)' },
    { keys: ['Escape'], action: 'Close and return focus to the trigger' },
  ],
  uncontrolled: 'No binding: the trigger opens the sheet and it keeps its own open state.',
  controlled: 'bind:open keeps the open state in your state, so a button outside can open it.',
  code: (v) => `<script lang="ts">
  import { Sheet } from '@texuli/primitives/sheet';
  let open = $state(false);
${SCRIPT_END}

<Sheet.Root bind:open>
  <Sheet.Trigger>Filters</Sheet.Trigger>
  <Sheet.Portal>
    <Sheet.Overlay />
    <Sheet.Content${attr('side', String(v.side), 'right')}${attr('modal', v.modal === true, true)}>
      <Sheet.Title>Filters</Sheet.Title>
      <Sheet.Description>Narrow the orders list.</Sheet.Description>
      <Sheet.Close>Apply</Sheet.Close>
    </Sheet.Content>
  </Sheet.Portal>
</Sheet.Root>
${recipeLine('sheetContentClass', 'texuli/sheet', { size: String(v.size) })}`,
  keyCheck: {
    open: '[data-demo-part="Sheet.Trigger"]',
    focus: '[data-demo-part="Sheet.Close"]',
    press: 'Escape',
    expect: { selector: '[data-demo-part="Sheet.Content"]', count: 0 },
  },
  controlCheck: {
    act: '[data-demo-act="open"]',
    expect: {
      selector: '[data-demo-part="Sheet.Content"]',
      attribute: 'data-state',
      value: 'open',
    },
  },
};
</script>

<script lang="ts">
import { Sheet } from '@texuli/primitives/sheet';
import { Button, buttonVariants } from 'texuli/button';
import { dialogDescriptionClass, dialogTitleClass } from 'texuli/dialog';
import { Input } from 'texuli/input';
import { sheetContentClass } from 'texuli/sheet';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode, portal }: DemoProps = $props();

const SIDES = ['start', 'end', 'top', 'bottom'] as const;
const SIZES = ['sm', 'md', 'lg'] as const;
const side = $derived(SIDES.find((entry) => entry === str(values, 'side')) ?? 'start');
const size = $derived(SIZES.find((entry) => entry === str(values, 'size')) ?? 'sm');
const modal = $derived(bool(values, 'modal', true));

let open = $state(false);
let customer = $state('');
</script>

{#snippet parts()}
  <Sheet.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })} data-demo-part="Sheet.Trigger">Open filters</Sheet.Trigger>
  <Sheet.Portal to={portal}>
    {#if modal}
      <Sheet.Overlay class="tx-sheet-overlay" data-tx-sheet-overlay="" data-demo-part="Sheet.Overlay" />
    {/if}
    {#key `${side}-${modal}`}
      <Sheet.Content {side} {modal} class={sheetContentClass({ size })} data-tx-sheet="" data-size={size} data-demo-part="Sheet.Content">
        <div class="demo-sheet">
          <Sheet.Title class={dialogTitleClass()} data-demo-part="Sheet.Title">Filters</Sheet.Title>
          <Sheet.Description class={dialogDescriptionClass()} data-demo-part="Sheet.Description">Narrow the orders list by customer.</Sheet.Description>
          <label class="demo-sheet__field">
            Customer
            <Input bind:value={customer} placeholder="name@example.com" />
          </label>
          <Sheet.Close class={buttonVariants({ size: 'sm' })} data-demo-part="Sheet.Close">Apply</Sheet.Close>
        </div>
      </Sheet.Content>
    {/key}
  </Sheet.Portal>
{/snippet}

{#if mode === 'uncontrolled'}
  <Sheet.Root>
    {@render parts()}
  </Sheet.Root>
{:else}
  <Sheet.Root bind:open>
    {@render parts()}
  </Sheet.Root>
  <div class="demo-controls">
    <output data-demo-readout>open: {open}</output>
    <Button size="sm" variant="ghost" onclick={() => (open = true)} data-demo-act="open">Open from outside</Button>
  </div>
{/if}

<style>
  .demo-sheet {
    display: grid;
    align-content: start;
    justify-items: start;
    gap: 0.75rem;
  }
  .demo-sheet__field {
    display: grid;
    gap: 0.375rem;
    justify-self: stretch;
    font-size: 0.875rem;
  }
</style>

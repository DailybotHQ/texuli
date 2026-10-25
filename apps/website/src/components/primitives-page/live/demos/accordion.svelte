<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'type',
      label: 'type',
      options: ['single', 'multiple'],
      default: 'single',
    },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['default', 'bordered'],
      default: 'default',
    },
    { kind: 'boolean', name: 'collapsible', label: 'collapsible', default: true },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['Enter', ' '], action: 'Expand or collapse the focused section' },
    { keys: ['ArrowDown', 'ArrowUp'], action: 'Move to the next or previous header' },
    { keys: ['Home', 'End'], action: 'Move to the first or last header' },
  ],
  uncontrolled:
    'A plain value (no binding) opens "Shipping" first; the accordion keeps its own state.',
  controlled:
    'bind:value keeps the open sections in your state, so buttons outside can change them.',
  code: (v) => `<script lang="ts">
  import { Accordion } from '@texuli/primitives/accordion';
  let value = $state(${v.type === 'multiple' ? "['shipping']" : "'shipping'"});
${SCRIPT_END}

<Accordion.Root type="${v.type}" bind:value${v.type === 'single' ? attr('collapsible', v.collapsible === true, false) : ''}${attr('disabled', v.disabled === true, false)}>
  <Accordion.Item value="shipping">
    <Accordion.Header level={3}>
      <Accordion.Trigger>Shipping</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Content>Orders ship within two days.</Accordion.Content>
  </Accordion.Item>
  <!-- …more items -->
</Accordion.Root>${v.type === 'multiple' && v.collapsible === false ? '\n<!-- collapsible applies to type="single" only: with type="multiple" every section can close -->' : ''}

${recipeLine('accordionRootClass', 'texuli/tabs-accordion', { variant: v.variant ?? 'default' })}`,
  keyCheck: {
    focus: '[data-demo-part="Accordion.Trigger"]:not([disabled])',
    press: 'ArrowDown',
    expect: { selector: '[data-demo-part="Accordion.Trigger"]:focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="returns"]',
    expect: {
      selector: '[data-demo-part="Accordion.Trigger"][data-value="returns"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { Accordion } from '@texuli/primitives/accordion';
import { Button } from 'texuli/button';
import { Icon } from 'texuli/icons';
import { accordionRootClass } from 'texuli/tabs-accordion';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const ITEMS = [
  { value: 'shipping', title: 'Shipping', body: 'Orders ship within two days of payment.' },
  { value: 'returns', title: 'Returns', body: 'Return any item within 30 days for a refund.' },
  { value: 'warranty', title: 'Warranty (unavailable)', body: 'Covered for a year.', disabled: true },
  { value: 'support', title: 'Support', body: 'Write to help@example.com any day of the week.' },
];
// Each open section is a region named by its header, so the controlled panel
// uses its own titles: two "Shipping" regions on one page would be ambiguous.
const CONTROLLED_TITLES: Record<string, string> = {
  shipping: 'Delivery times',
  returns: 'Returns and refunds',
  warranty: 'Extended warranty (unavailable)',
  support: 'Contact support',
};

const type = $derived(str(values, 'type', 'single') === 'multiple' ? 'multiple' : 'single');
const variant = $derived(str(values, 'variant', 'default') === 'bordered' ? 'bordered' : 'default');
const collapsible = $derived(bool(values, 'collapsible', true));
const disabled = $derived(bool(values, 'disabled'));
const rootClass = $derived(accordionRootClass({ variant }));

let single = $state('shipping');
let multiple = $state<string[]>(['shipping']);
const openLabel = $derived(
  type === 'single' ? single || 'none' : multiple.length ? multiple.join(', ') : 'none'
);

function openReturns(): void {
  if (type === 'single') single = 'returns';
  else multiple = [...new Set([...multiple, 'returns'])];
}
function closeAll(): void {
  single = '';
  multiple = [];
}
</script>

{#snippet items()}
  {#each ITEMS as item (item.value)}
    <Accordion.Item value={item.value} disabled={item.disabled} class="tx-accordion__item" data-tx-accordion-item="" data-demo-part="Accordion.Item">
      <Accordion.Header level={4} class="tx-accordion__header" data-demo-part="Accordion.Header">
        <Accordion.Trigger class="tx-accordion__trigger" data-tx-accordion-trigger="" data-demo-part="Accordion.Trigger" data-value={item.value}>
          {mode === 'controlled' ? (CONTROLLED_TITLES[item.value] ?? item.title) : item.title}
          <Icon icon="chevron-down" size="sm" class="tx-accordion__chevron" aria-hidden="true" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content class="tx-accordion__content" data-tx-accordion-content="" data-demo-part="Accordion.Content">
        <div class="tx-accordion__content-inner">{item.body}</div>
      </Accordion.Content>
    </Accordion.Item>
  {/each}
{/snippet}

{#if mode === 'uncontrolled'}
  {#key type}
    {#if type === 'single'}
      <Accordion.Root type="single" value="shipping" {collapsible} {disabled} class={rootClass} data-tx-accordion="" data-variant={variant} data-demo-part="Accordion.Root">
        {@render items()}
      </Accordion.Root>
    {:else}
      <Accordion.Root type="multiple" value={['shipping']} {disabled} class={rootClass} data-tx-accordion="" data-variant={variant} data-demo-part="Accordion.Root">
        {@render items()}
      </Accordion.Root>
    {/if}
  {/key}
{:else}
  {#if type === 'single'}
    <Accordion.Root type="single" bind:value={single} {collapsible} {disabled} class={rootClass} data-tx-accordion="" data-variant={variant} data-demo-part="Accordion.Root">
      {@render items()}
    </Accordion.Root>
  {:else}
    <Accordion.Root type="multiple" bind:value={multiple} {disabled} class={rootClass} data-tx-accordion="" data-variant={variant} data-demo-part="Accordion.Root">
      {@render items()}
    </Accordion.Root>
  {/if}
  <div class="demo-controls">
    <output data-demo-readout>Open: {openLabel}</output>
    <Button size="sm" variant="outline" onclick={openReturns} data-demo-act="returns">Open Returns</Button>
    <Button size="sm" variant="ghost" onclick={closeAll}>Close all</Button>
  </div>
{/if}

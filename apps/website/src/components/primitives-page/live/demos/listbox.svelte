<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'boolean', name: 'multiple', label: 'multiple', default: false },
    { kind: 'boolean', name: 'loop', label: 'loop', default: true },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
    { kind: 'enum', name: 'size', label: 'Style size', options: ['sm', 'md', 'lg'], default: 'md' },
  ],
  keys: [
    {
      keys: ['ArrowDown', 'ArrowUp'],
      action: 'Next or previous option (selects it in single mode)',
    },
    { keys: ['Home', 'End'], action: 'First or last option' },
    { keys: ['Enter', ' '], action: 'Select the active option (toggles it in multiple mode)' },
    { keys: ['a', 'b', 'j'], action: 'Type a letter: jump to the next matching option' },
  ],
  uncontrolled: 'defaultValue starts on "Blue"; the listbox keeps its own selection.',
  controlled: 'bind:value keeps the selection in your state, so buttons outside can change it.',
  code: (v) => `<script lang="ts">
  import { ListboxOption, ListboxRoot } from '@texuli/primitives/listbox';
  const items = [
    { value: 'amber', label: 'Amber' },
    { value: 'blue', label: 'Blue' },
    { value: 'coral', label: 'Coral', disabled: true },
    { value: 'jade', label: 'Jade' },
  ];
  let value = $state(${v.multiple === true ? "['blue']" : "'blue'"});
${SCRIPT_END}

<ListboxRoot aria-label="Label color" {items} bind:value${attr('multiple', v.multiple === true, false)}${attr('loop', v.loop === true, true)}${attr('disabled', v.disabled === true, false)}>
  {#each items as item (item.value)}
    <ListboxOption value={item.value} label={item.label} disabled={item.disabled}>
      {item.label}
    </ListboxOption>
  {/each}
</ListboxRoot>

${recipeLine('selectContentClass', 'texuli/select', { size: v.size ?? 'md' })}`,
  keyCheck: {
    focus: '[data-demo-part="ListboxRoot"]',
    press: 'End',
    expect: {
      selector: '[data-demo-part="ListboxOption"][data-value="jade"]',
      attribute: 'aria-selected',
      value: 'true',
    },
  },
  controlCheck: {
    act: '[data-demo-act="amber"]',
    expect: {
      selector: '[data-demo-part="ListboxOption"][data-value="amber"]',
      attribute: 'aria-selected',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { ListboxOption, ListboxRoot } from '@texuli/primitives/listbox';
import { Button } from 'texuli/button';
import { type SelectSize, selectContentClass, selectItemClass } from 'texuli/select';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const ITEMS = [
  { value: 'amber', label: 'Amber' },
  { value: 'blue', label: 'Blue' },
  { value: 'coral', label: 'Coral (unavailable)', disabled: true },
  { value: 'jade', label: 'Jade' },
];

const multiple = $derived(bool(values, 'multiple'));
const loop = $derived(bool(values, 'loop', true));
const disabled = $derived(bool(values, 'disabled'));
const size = $derived<SelectSize>(
  (['sm', 'md', 'lg'] as const).find((s) => s === str(values, 'size', 'md')) ?? 'md'
);
const rootClass = $derived(selectContentClass({ size, class: 'demo-listbox' }));

let single = $state<string | readonly string[] | undefined>('blue');
let many = $state<string | readonly string[] | undefined>(['blue']);
const readout = $derived.by(() => {
  const current = multiple ? many : single;
  if (Array.isArray(current)) return current.length ? current.join(', ') : 'none';
  return current || 'none';
});

function pickAmber(): void {
  if (multiple) many = ['amber'];
  else single = 'amber';
}
</script>

{#snippet options()}
  {#each ITEMS as item (item.value)}
    <ListboxOption value={item.value} label={item.label} disabled={item.disabled} class={selectItemClass({ disabled: item.disabled === true })} data-tx-select-item data-value={item.value} data-demo-part="ListboxOption">
      <span class="tx-select-item__check" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
          <path d="M3.5 8.25 6.75 11.5 12.5 4.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
      <span class="tx-select-item__body"><span class="tx-select-item__label">{item.label}</span></span>
    </ListboxOption>
  {/each}
{/snippet}

{#if mode === 'uncontrolled'}
  {#key multiple}
    <ListboxRoot aria-label="Label color" items={ITEMS} defaultValue={multiple ? ['blue'] : 'blue'} {multiple} {loop} {disabled} class={rootClass} data-tx-select-content data-size={size} data-demo-part="ListboxRoot">
      {@render options()}
    </ListboxRoot>
  {/key}
{:else}
  {#if multiple}
    <ListboxRoot aria-label="Tag colors" items={ITEMS} bind:value={many} multiple {loop} {disabled} class={rootClass} data-tx-select-content data-size={size} data-demo-part="ListboxRoot">
      {@render options()}
    </ListboxRoot>
  {:else}
    <ListboxRoot aria-label="Tag color" items={ITEMS} bind:value={single} {loop} {disabled} class={rootClass} data-tx-select-content data-size={size} data-demo-part="ListboxRoot">
      {@render options()}
    </ListboxRoot>
  {/if}
  <div class="demo-controls">
    <output data-demo-readout>value: {readout}</output>
    <Button size="sm" variant="outline" onclick={pickAmber} data-demo-act="amber">Choose Amber</Button>
  </div>
{/if}

<style>
  /* The list is inline here, not a floating panel: no shadow, no float layer. */
  :global(.demo-listbox) {
    position: static;
    box-shadow: none;
    max-inline-size: 18rem;
  }
  :global(.demo-listbox:focus-visible) {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>

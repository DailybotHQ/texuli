<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'boolean', name: 'multiple', label: 'multiple', default: false },
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['outline', 'soft'],
      default: 'outline',
    },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['ArrowDown', 'ArrowUp'], action: 'Open the list and move the highlighted option' },
    { keys: ['Enter'], action: 'Choose the highlighted option' },
    { keys: ['Escape'], action: 'Close the list' },
    { keys: ['Backspace'], action: 'With multiple and an empty field: remove the last chip' },
  ],
  uncontrolled: 'Type to filter; defaultValue seeds the choice and the combobox keeps it.',
  controlled:
    'bind:value, bind:inputValue and bind:open: your state drives the field and the list.',
  code: (v) => `<script lang="ts">
  import { Combobox } from '@texuli/primitives/combobox';
  const people = [
    { value: 'ada', label: 'Ada Example' },
    { value: 'grace', label: 'Grace Sample' },
  ];
  let value = $state(${v.multiple === true ? '[]' : "''"});
${SCRIPT_END}

<label for="assignee">Assignee</label>
<Combobox.Root bind:value items={people}${attr('multiple', v.multiple === true, false)}${attr('disabled', v.disabled === true, false)}>
${
  v.multiple === true
    ? `  <Combobox.Chips>
    {#each value as person (person)}
      <Combobox.Chip value={person}><Combobox.ChipRemove value={person} /></Combobox.Chip>
    {/each}
  </Combobox.Chips>
`
    : ''
}  <Combobox.Input id="assignee" />
  <Combobox.Trigger aria-label="Show people" />
  <Combobox.Portal>
    <Combobox.Content>
      <Combobox.Viewport>
        {#snippet children(person)}
          <Combobox.Item value={person.value}>{person.label}</Combobox.Item>
        {/snippet}
      </Combobox.Viewport>
      <Combobox.Empty>No one matches.</Combobox.Empty>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>

${recipeLine('comboboxFieldClass', 'texuli/combobox', { size: v.size ?? 'md', variant: v.variant ?? 'outline' })}`,
  keyCheck: {
    focus: '[data-demo-part="Combobox.Input"]',
    press: 'ArrowDown',
    expect: {
      selector: '[data-demo-part="Combobox.Input"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
  controlCheck: {
    act: '[data-demo-act="open"]',
    expect: {
      selector: '[data-demo-part="Combobox.Input"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { Combobox, type ComboboxSelection } from '@texuli/primitives/combobox';
import { Button } from 'texuli/button';
import {
  type ComboboxSize,
  type ComboboxVariant,
  comboboxChipClass,
  comboboxChipsClass,
  comboboxContentClass,
  comboboxEmptyClass,
  comboboxFieldClass,
  comboboxInputClass,
  comboboxItemClass,
  comboboxRootClass,
  comboboxTriggerClass,
} from 'texuli/combobox';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const uid = $props.id();
const PEOPLE = [
  { value: 'ada', label: 'Ada Example' },
  { value: 'grace', label: 'Grace Sample' },
  { value: 'linus', label: 'Linus Demo' },
  { value: 'margaret', label: 'Margaret Placeholder' },
  { value: 'alan', label: 'Alan Fixture', disabled: true },
];

const multiple = $derived(bool(values, 'multiple'));
const size = $derived<ComboboxSize>(
  (['sm', 'md', 'lg'] as const).find((option) => option === str(values, 'size')) ?? 'md'
);
const variant = $derived<ComboboxVariant>(str(values, 'variant') === 'soft' ? 'soft' : 'outline');
const disabled = $derived(bool(values, 'disabled'));

let value = $state<ComboboxSelection>('');
let inputValue = $state('');
let open = $state(false);
const chosen = $derived(Array.isArray(value) ? value : value ? [value] : []);

$effect(() => {
  // A new mode starts from an empty selection of the right shape.
  value = multiple ? [] : '';
  inputValue = '';
});

function assignGrace(): void {
  value = multiple ? [...new Set([...chosen, 'grace'])] : 'grace';
  inputValue = multiple ? '' : 'Grace Sample';
}
</script>

{#snippet field()}
  <label class="tx-choice__label" for="{uid}-input">Assignee</label>
  <div class={comboboxFieldClass({ size, variant })} data-tx-combobox-field="" data-size={size} data-variant={variant}>
    {#if multiple}
      <Combobox.Chips class={comboboxChipsClass()} data-tx-combobox-chips="" data-demo-part="Combobox.Chips">
        <!-- A Chip renders only while its value is selected. -->
        {#each PEOPLE as person (person.value)}
          <Combobox.Chip value={person.value} class={comboboxChipClass()} data-tx-combobox-chip="" data-demo-part="Combobox.Chip">
            <span class="tx-combobox-chip__label">{person.label}</span>
            <Combobox.ChipRemove value={person.value} class="tx-combobox-chip__remove" data-demo-part="Combobox.ChipRemove">×</Combobox.ChipRemove>
          </Combobox.Chip>
        {/each}
      </Combobox.Chips>
    {/if}
    <Combobox.Input id="{uid}-input" class={comboboxInputClass({ size })} data-tx-combobox-input="" data-size={size} data-demo-part="Combobox.Input" />
    <Combobox.Trigger aria-label="Show people" class={comboboxTriggerClass()} data-tx-combobox-trigger="" data-demo-part="Combobox.Trigger">
      <svg class="tx-combobox-trigger__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4.5 6.25 8 9.75l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </Combobox.Trigger>
  </div>
  <Combobox.Portal>
    <Combobox.Content class={comboboxContentClass({ size })} data-tx-combobox-content="" data-size={size} data-demo-part="Combobox.Content">
      <Combobox.Viewport data-demo-part="Combobox.Viewport">
        {#snippet children(person)}
          <Combobox.Item
            value={person.value}
            label={person.label}
            class={comboboxItemClass({ disabled: person.disabled })}
            data-tx-combobox-item=""
            data-demo-part="Combobox.Item"
          >
            <span class="tx-combobox-item__check" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
                <path d="M3.5 8.25 6.75 11.5 12.5 4.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="tx-combobox-item__label">{person.label}</span>
          </Combobox.Item>
        {/snippet}
      </Combobox.Viewport>
      <Combobox.Empty class={comboboxEmptyClass()} data-tx-combobox-empty="" data-demo-part="Combobox.Empty">No one matches that name.</Combobox.Empty>
    </Combobox.Content>
  </Combobox.Portal>
{/snippet}

<!-- Combobox.Root renders no element of its own: the marker sits on the styled wrapper. -->
{#if mode === 'uncontrolled'}
  {#key multiple}
    <div class={comboboxRootClass({ multiple })} data-tx-combobox-root="" data-size={size} data-variant={variant} data-demo-part="Combobox.Root">
      <Combobox.Root
        items={PEOPLE}
        {multiple}
        {disabled}
        defaultValue={multiple ? ['ada'] : 'ada'}
        defaultInputValue={multiple ? '' : 'Ada Example'}
      >
        {@render field()}
      </Combobox.Root>
    </div>
  {/key}
{:else}
  {#key multiple}
    <div class={comboboxRootClass({ multiple })} data-tx-combobox-root="" data-size={size} data-variant={variant} data-demo-part="Combobox.Root">
      <Combobox.Root items={PEOPLE} {multiple} {disabled} bind:value bind:inputValue bind:open>
        {@render field()}
      </Combobox.Root>
    </div>
  {/key}
  <div class="demo-controls">
    <output data-demo-readout>value: {chosen.length ? chosen.join(', ') : 'none'} · open: {open}</output>
    <Button size="sm" variant="outline" onclick={assignGrace}>Assign Grace</Button>
    <Button size="sm" variant="outline" onclick={() => (open = true)} data-demo-act="open">Show options</Button>
    <Button size="sm" variant="ghost" onclick={() => { value = multiple ? [] : ''; inputValue = ''; }}>Clear</Button>
  </div>
{/if}

<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['default', 'outline'],
      default: 'outline',
    },
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
    {
      kind: 'enum',
      name: 'type',
      label: 'Group type',
      options: ['single', 'multiple'],
      default: 'single',
    },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: [' ', 'Enter'], action: 'Press or release the focused toggle' },
    { keys: ['ArrowRight', 'ArrowLeft'], action: 'Move between items in a group (one Tab stop)' },
    { keys: ['Home', 'End'], action: 'Move to the first or last item in a group' },
  ],
  uncontrolled: 'defaultPressed and defaultValue set the first state; the toggles keep their own.',
  controlled:
    'bind:pressed and bind:value keep the state in your code, so buttons outside can change it.',
  code: (v) => `<script lang="ts">
  import { Toggle, ToggleGroup } from '@texuli/primitives/toggle';
  let bold = $state(false);
  let align = $state(${v.type === 'multiple' ? "['left']" : "'left'"});
${SCRIPT_END}

<Toggle.Root bind:pressed={bold} aria-label="Bold"${attr('disabled', v.disabled === true, false)}>B</Toggle.Root>

<ToggleGroup.Root type="${v.type}" bind:value={align} aria-label="Text alignment"${attr('disabled', v.disabled === true, false)}>
  <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
  <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
  <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
</ToggleGroup.Root>
${recipeLine('toggleClass', 'texuli/toggle', { variant: String(v.variant), size: String(v.size) })}`,
  keyCheck: {
    focus: '[data-demo-part="ToggleGroup.Item"][data-value="left"]',
    press: 'ArrowRight',
    expect: {
      selector: '[data-demo-part="ToggleGroup.Item"][data-value="center"]:focus',
      count: 1,
    },
  },
  controlCheck: {
    act: '[data-demo-act="bold"]',
    expect: {
      selector: '[data-demo-part="Toggle.Root"]',
      attribute: 'aria-pressed',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { Toggle, ToggleGroup } from '@texuli/primitives/toggle';
import { Button } from 'texuli/button';
import { toggleClass, toggleGroupClass } from 'texuli/toggle';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const ITEMS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const variant = $derived(str(values, 'variant') === 'default' ? 'default' : 'outline');
const size = $derived((['sm', 'md', 'lg'] as const).find((entry) => entry === str(values, 'size')) ?? 'md');
const type = $derived(str(values, 'type') === 'multiple' ? 'multiple' : 'single');
const disabled = $derived(bool(values, 'disabled'));
const itemClass = $derived(toggleClass({ variant, size }));
const groupClass = $derived(toggleGroupClass({ orientation: 'horizontal', variant }));

let bold = $state(false);
let single = $state('left');
let multiple = $state<string[]>(['left']);
const alignLabel = $derived(type === 'single' ? single || 'none' : multiple.join(', ') || 'none');
</script>

{#snippet items()}
  {#each ITEMS as item (item.value)}
    <ToggleGroup.Item value={item.value} class={itemClass} data-value={item.value} data-demo-part="ToggleGroup.Item">{item.label}</ToggleGroup.Item>
  {/each}
{/snippet}

<div class="demo-row">
  {#if mode === 'uncontrolled'}
    <Toggle.Root defaultPressed aria-label="Bold" {disabled} class={itemClass} data-demo-part="Toggle.Root"><strong>B</strong></Toggle.Root>
    {#key type}
      <ToggleGroup.Root {type} defaultValue={type === 'single' ? 'left' : ['left']} aria-label="Text alignment" {disabled} class={groupClass} data-demo-part="ToggleGroup.Root">
        {@render items()}
      </ToggleGroup.Root>
    {/key}
  {:else}
    <Toggle.Root bind:pressed={bold} aria-label="Bold" {disabled} class={itemClass} data-demo-part="Toggle.Root"><strong>B</strong></Toggle.Root>
    {#if type === 'single'}
      <ToggleGroup.Root type="single" bind:value={single} aria-label="Text alignment" {disabled} class={groupClass} data-demo-part="ToggleGroup.Root">
        {@render items()}
      </ToggleGroup.Root>
    {:else}
      <ToggleGroup.Root type="multiple" bind:value={multiple} aria-label="Text alignment" {disabled} class={groupClass} data-demo-part="ToggleGroup.Root">
        {@render items()}
      </ToggleGroup.Root>
    {/if}
  {/if}
</div>

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>Bold: {bold ? 'on' : 'off'} · Align: {alignLabel}</output>
    <Button size="sm" variant="outline" onclick={() => (bold = !bold)} data-demo-act="bold">Toggle bold</Button>
    <Button size="sm" variant="ghost" onclick={() => { single = 'right'; multiple = ['right']; }}>Align right</Button>
  </div>
{/if}

<style>
  .demo-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
</style>

<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'format',
      label: 'format',
      options: ['hex', 'rgb', 'hsl', 'oklch'],
      default: 'hex',
    },
    { kind: 'string', name: 'label', label: 'label', default: 'Brand color' },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['ArrowUp', 'ArrowDown'], action: 'Area: more or less lightness (Shift: ten steps)' },
    {
      keys: ['ArrowLeft', 'ArrowRight'],
      action: 'Area: less or more chroma; sliders: change hue or opacity',
    },
    { keys: ['Home', 'End'], action: 'Area: darkest gray or lightest, most vivid corner' },
  ],
  uncontrolled:
    'defaultValue seeds the color; the picker keeps it as you drag, type or pick a swatch.',
  controlled: 'bind:value holds the formatted string in your state; buttons outside set it.',
  code: (v) => `<script lang="ts">
  import { ColorPicker } from '@texuli/primitives/color-picker';
  let value = $state('#2563eb');
${SCRIPT_END}

<ColorPicker.Root bind:value label="${v.label}"${attr('format', v.format ?? 'hex', 'hex')}${attr('disabled', v.disabled === true, false)}>
  <ColorPicker.Area />
  <ColorPicker.Hue />
  <ColorPicker.Alpha />
  <ColorPicker.FormatInput />
  <ColorPicker.Swatch value="#22c55e" label="Green" />
</ColorPicker.Root>`,
  keyCheck: {
    focus: '[data-demo-part="ColorPicker.Area"]',
    press: 'Home',
    expect: {
      selector: '[data-demo-part="ColorPicker.Area"]',
      attribute: 'aria-valuenow',
      value: '0',
    },
  },
  controlCheck: {
    act: '[data-demo-act="green"]',
    expect: {
      selector: '[data-demo-part="ColorPicker.Swatch"][aria-label="Green"]',
      attribute: 'aria-pressed',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { type ColorFormat, ColorPicker } from '@texuli/primitives/color-picker';
import { Button } from 'texuli/button';
// The color picker styles ship with the tags-color entry.
import 'texuli/tags-color';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const SWATCHES = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#22c55e', label: 'Green' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#a855f7', label: 'Purple' },
];
const FORMATS: readonly ColorFormat[] = ['hex', 'rgb', 'hsl', 'oklch'];

const format = $derived<ColorFormat>(FORMATS.find((option) => option === str(values, 'format')) ?? 'hex');
const label = $derived(str(values, 'label') || 'Brand color');
const disabled = $derived(bool(values, 'disabled'));

let preview = $state('#2563eb');
let value = $state('#2563eb');
</script>

{#snippet parts(color: string)}
  <ColorPicker.Area class="tx-color-picker__area" data-tx-color-area="" data-demo-part="ColorPicker.Area" />
  <div class="tx-color-picker__sliders">
    <ColorPicker.Hue class="tx-color-picker__slider tx-color-picker__slider--hue" data-demo-part="ColorPicker.Hue" />
    <ColorPicker.Alpha class="tx-color-picker__slider" data-demo-part="ColorPicker.Alpha" />
  </div>
  <div class="tx-color-picker__row">
    <span class="tx-color-picker__preview" style={`background-color: ${color}`} aria-hidden="true" data-tx-color-preview=""></span>
    <ColorPicker.FormatInput class="tx-color-picker__format" data-tx-color-format="" data-demo-part="ColorPicker.FormatInput" />
  </div>
  <div class="tx-color-picker__swatches" role="list" aria-label="Color swatches">
    {#each SWATCHES as swatch (swatch.value)}
      <div class="tx-color-picker__swatch-item" role="listitem">
        <ColorPicker.Swatch
          value={swatch.value}
          label={swatch.label}
          class="tx-color-picker__swatch"
          style={`--tx-swatch-color: ${swatch.value}; background-color: ${swatch.value}`}
          data-tx-color-swatch=""
          data-demo-part="ColorPicker.Swatch"
        />
      </div>
    {/each}
  </div>
{/snippet}

{#if mode === 'uncontrolled'}
  {#key format}
    <ColorPicker.Root
      defaultValue="#2563eb"
      {format}
      {label}
      {disabled}
      onValueChange={(next) => (preview = next)}
      class="tx-color-picker"
      data-tx-color-picker=""
      data-disabled={disabled ? 'true' : undefined}
      style={`--tx-color-picker-value: ${preview}`}
      data-demo-part="ColorPicker.Root"
    >
      {@render parts(preview)}
    </ColorPicker.Root>
  {/key}
{:else}
  <ColorPicker.Root
    bind:value
    {format}
    {label}
    {disabled}
    class="tx-color-picker"
    data-tx-color-picker=""
    data-disabled={disabled ? 'true' : undefined}
    style={`--tx-color-picker-value: ${value}`}
    data-demo-part="ColorPicker.Root"
  >
    {@render parts(value)}
  </ColorPicker.Root>
  <div class="demo-controls">
    <output data-demo-readout>value: {value}</output>
    <Button size="sm" variant="outline" onclick={() => (value = '#22c55e')} data-demo-act="green">Set green</Button>
    <Button size="sm" variant="ghost" onclick={() => (value = '#2563eb')}>Reset</Button>
  </div>
{/if}

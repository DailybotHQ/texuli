<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'type',
      label: 'type',
      options: ['single', 'multiple'],
      default: 'single',
    },
    { kind: 'number', name: 'step', label: 'step', min: 1, max: 25, step: 1, default: 5 },
    { kind: 'boolean', name: 'ticks', label: 'Ticks (Slider.Tick)', default: true },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    {
      keys: ['ArrowRight', 'ArrowUp'],
      action: 'Increase by one step (Left and Right swap in RTL)',
    },
    { keys: ['ArrowLeft', 'ArrowDown'], action: 'Decrease by one step' },
    { keys: ['PageUp', 'PageDown'], action: 'Move by a large step (ten steps)' },
    { keys: ['Home', 'End'], action: 'Jump to the minimum or maximum' },
  ],
  uncontrolled:
    'A plain value (no binding) starts the volume at 40; the slider keeps its own state.',
  controlled: 'bind:value keeps the value in your state, so buttons outside can set it.',
  code: (v) => `<script lang="ts">
  import { Slider } from '@texuli/primitives/slider';
  let value = $state(${v.type === 'multiple' ? '[20, 60]' : '40'});
${SCRIPT_END}

<Slider.Root${v.type === 'multiple' ? ' type="multiple"' : ''} bind:value min={0} max={100}${attr('step', v.step as number, 1)}${attr('disabled', v.disabled === true, false)} aria-label="Volume">
  {#snippet children({ thumbItems, tickItems })}
    <Slider.Range />${
      v.ticks
        ? `
    {#each tickItems as tick (tick.index)}
      <Slider.Tick index={tick.index} />
    {/each}`
        : ''
    }
    {#each thumbItems as thumb (thumb.index)}
      <Slider.Thumb index={thumb.index} aria-label="Volume" />
    {/each}
  {/snippet}
</Slider.Root>`,
  keyCheck: {
    focus: '[data-demo-part="Slider.Thumb"]',
    press: 'End',
    expect: {
      selector: '[data-demo-part="Slider.Thumb"]',
      attribute: 'aria-valuenow',
      value: '100',
    },
  },
  controlCheck: {
    act: '[data-demo-act="max"]',
    expect: {
      selector: '[data-demo-part="Slider.Thumb"]',
      attribute: 'aria-valuenow',
      value: '100',
    },
  },
};
</script>

<script lang="ts">
import { Slider } from '@texuli/primitives/slider';
import { Button } from 'texuli/button';
import { sliderRootClass } from 'texuli/slider';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode, dir }: DemoProps = $props();

const type = $derived(str(values, 'type', 'single') === 'multiple' ? 'multiple' : 'single');
const step = $derived(Math.max(1, num(values, 'step', 5)));
const ticks = $derived(bool(values, 'ticks', true) && 100 / step <= 25);
const disabled = $derived(bool(values, 'disabled'));
const rootClass = $derived(sliderRootClass({ size: 'md', orientation: 'horizontal' }));
const labelId = $props.id();

let single = $state(40);
let range = $state<number[]>([20, 60]);
const readout = $derived(type === 'single' ? String(single) : range.join(' to '));

function setMax(): void {
  if (type === 'single') single = 100;
  else range = [range[0] ?? 0, 100];
}
function setMin(): void {
  if (type === 'single') single = 0;
  else range = [0, range[1] ?? 100];
}
const thumbLabel = (index: number) =>
  type === 'multiple' ? (index === 0 ? 'Minimum volume' : 'Maximum volume') : 'Volume';
</script>

{#snippet track(thumbItems: { index: number }[], tickItems: { index: number }[])}
  <span class="tx-slider__track" data-tx-slider-track=""></span>
  <Slider.Range class="tx-slider__range" data-demo-part="Slider.Range" />
  {#if ticks}
    {#each tickItems as tick (tick.index)}
      <Slider.Tick index={tick.index} class="tx-slider__tick" data-demo-part="Slider.Tick" />
    {/each}
  {/if}
  {#each thumbItems as thumb (thumb.index)}
    <Slider.Thumb index={thumb.index} class="tx-slider__thumb" aria-label={thumbLabel(thumb.index)} data-demo-part="Slider.Thumb" />
  {/each}
{/snippet}

<div class="tx-slider-field" data-tx-slider-field="">
  <div class="tx-slider-field__header">
    <span class="tx-slider-field__label" id="{labelId}-{mode}">Volume</span>
  </div>
  <div class="tx-slider-field__control">
    {#if mode === 'uncontrolled'}
      {#key type}
        {#if type === 'single'}
          <Slider.Root type="single" value={40} min={0} max={100} {step} {disabled} {dir} class={rootClass} aria-labelledby="{labelId}-{mode}" data-demo-part="Slider.Root">
            {#snippet children({ thumbItems, tickItems })}
              {@render track(thumbItems, tickItems)}
            {/snippet}
          </Slider.Root>
        {:else}
          <Slider.Root type="multiple" value={[20, 60]} min={0} max={100} {step} {disabled} {dir} class={rootClass} aria-labelledby="{labelId}-{mode}" data-demo-part="Slider.Root">
            {#snippet children({ thumbItems, tickItems })}
              {@render track(thumbItems, tickItems)}
            {/snippet}
          </Slider.Root>
        {/if}
      {/key}
    {:else if type === 'single'}
      <Slider.Root type="single" bind:value={single} min={0} max={100} {step} {disabled} {dir} class={rootClass} aria-labelledby="{labelId}-{mode}" data-demo-part="Slider.Root">
        {#snippet children({ thumbItems, tickItems })}
          {@render track(thumbItems, tickItems)}
        {/snippet}
      </Slider.Root>
    {:else}
      <Slider.Root type="multiple" bind:value={range} min={0} max={100} {step} {disabled} {dir} class={rootClass} aria-labelledby="{labelId}-{mode}" data-demo-part="Slider.Root">
        {#snippet children({ thumbItems, tickItems })}
          {@render track(thumbItems, tickItems)}
        {/snippet}
      </Slider.Root>
    {/if}
  </div>
</div>

{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>Value: {readout}</output>
    <Button size="sm" variant="outline" onclick={setMin} data-demo-act="min">Set to 0</Button>
    <Button size="sm" variant="outline" onclick={setMax} data-demo-act="max">Set to 100</Button>
  </div>
{/if}

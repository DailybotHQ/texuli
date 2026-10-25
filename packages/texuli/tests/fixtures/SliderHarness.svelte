<script lang="ts">
import { Slider, type SliderSize } from '../../src/components/slider/index.ts';

type Props = {
  mode?: 'single' | 'range' | 'disabled' | 'marks';
  size?: SliderSize;
  label?: string;
};

let { mode = 'single', size = 'md', label = 'Volume' }: Props = $props();

let volume = $state(40);
let price = $state([200, 800]);
</script>

{#if mode === 'single'}
  <Slider
    bind:value={volume}
    min={0}
    max={100}
    step={5}
    {size}
    {label}
    showValue
    thumbLabel={label}
  />
{:else if mode === 'range'}
  <Slider
    type="multiple"
    bind:value={price}
    min={0}
    max={1000}
    step={10}
    label="Price"
    showValue
    thumbLabel={['Minimum price', 'Maximum price']}
  />
{:else if mode === 'disabled'}
  <Slider value={30} disabled label="Locked" showValue thumbLabel="Locked" />
{:else}
  <Slider
    value={50}
    min={0}
    max={100}
    step={25}
    label="Quality"
    showValue
    showTicks
    marks={[
      { value: 0, label: 'Low' },
      { value: 50, label: 'Mid' },
      { value: 100, label: 'High' },
    ]}
    thumbLabel="Quality"
  />
{/if}

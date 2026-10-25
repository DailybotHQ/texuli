<script lang="ts">
import { Slider } from '../src/slider/index.ts';

type Props = {
  type?: 'single' | 'multiple';
  value?: number | number[];
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  minStepsBetweenThumbs?: number;
  orientation?: 'horizontal' | 'vertical';
  dir?: 'ltr' | 'rtl';
  disabled?: boolean;
  name?: string;
  ticks?: boolean;
  childThumb?: boolean;
  getValueText?: (value: number, index: number) => string;
  onValueChange?: (value: number | number[]) => void;
  onValueCommit?: (value: number | number[]) => void;
};

let {
  type = 'single',
  value = $bindable(type === 'multiple' ? [20, 80] : 40),
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  minStepsBetweenThumbs = 0,
  orientation = 'horizontal',
  dir,
  disabled = false,
  name,
  ticks = false,
  childThumb = false,
  getValueText,
  onValueChange,
  onValueCommit,
}: Props = $props();

const labels = ['Minimum', 'Maximum'];
</script>

<form data-testid="form">
  {#if type === 'multiple'}
    <Slider.Root
      type="multiple"
      bind:value={value as number[]}
      {min}
      {max}
      {step}
      {largeStep}
      {minStepsBetweenThumbs}
      {orientation}
      {dir}
      {disabled}
      {name}
      {getValueText}
      onValueChange={(next) => onValueChange?.(next)}
      onValueCommit={(next) => onValueCommit?.(next)}
      data-testid="root"
    >
      {#snippet children({ thumbItems })}
        <Slider.Range data-testid="range" />
        {#each thumbItems as thumb (thumb.index)}
          <Slider.Thumb index={thumb.index} aria-label={labels[thumb.index]} />
        {/each}
      {/snippet}
    </Slider.Root>
  {:else}
    <Slider.Root
      type="single"
      bind:value={value as number}
      {min}
      {max}
      {step}
      {largeStep}
      {orientation}
      {dir}
      {disabled}
      {name}
      {getValueText}
      onValueChange={(next) => onValueChange?.(next)}
      onValueCommit={(next) => onValueCommit?.(next)}
      data-testid="root"
    >
      {#snippet children({ tickItems })}
        <Slider.Range data-testid="range" />
        {#if childThumb}
          <Slider.Thumb aria-label="Volume">
            {#snippet child({ props })}
              <button type="button" {...props} class="custom-thumb">Volume</button>
            {/snippet}
          </Slider.Thumb>
        {:else}
          <Slider.Thumb aria-label="Volume" />
        {/if}
        {#if ticks}
          {#each tickItems as tick (tick.index)}<Slider.Tick index={tick.index} />{/each}
        {/if}
      {/snippet}
    </Slider.Root>
  {/if}
  <button type="reset">Reset</button>
</form>

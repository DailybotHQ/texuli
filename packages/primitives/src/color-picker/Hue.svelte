<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { withHue } from './color.ts';
import { getColorPickerContext } from './context.ts';

type Props = Omit<HTMLInputAttributes, 'type' | 'min' | 'max' | 'value' | 'oninput'> & {
  label?: string;
} & RefProp;

let { label = 'Hue', ref = $bindable(null), ...rest }: Props = $props();
const context = getColorPickerContext();

function oninput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  context.setColor(withHue(context.color, Number(input.value)));
}
</script>

<input bind:this={ref}
  {...rest}
  type="range"
  min="0"
  max="360"
  step="1"
  value={context.color.h}
  aria-label={label}
  disabled={context.disabled}
  data-state={context.disabled ? 'disabled' : 'enabled'}
  oninput={oninput}
/>

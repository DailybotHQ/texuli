<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { withAlpha } from './color.ts';
import { getColorPickerContext } from './context.ts';

type Props = Omit<HTMLInputAttributes, 'type' | 'min' | 'max' | 'value' | 'oninput'> & {
  label?: string;
} & RefProp;

let { label = 'Opacity', ref = $bindable(null), ...rest }: Props = $props();
const context = getColorPickerContext();

function oninput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  context.setColor(withAlpha(context.color, Number(input.value) / 100));
}
</script>

<input bind:this={ref}
  {...rest}
  type="range"
  min="0"
  max="100"
  step="1"
  value={Math.round(context.color.a * 100)}
  aria-label={label}
  disabled={context.disabled}
  data-state={context.disabled ? 'disabled' : 'enabled'}
  oninput={oninput}
/>

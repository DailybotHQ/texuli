<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { colorToHex, parseFormattedColor } from './color.ts';
import { getColorPickerContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'type' | 'value'> & {
  value: string;
  label: string;
} & RefProp;

let { value, label, ref = $bindable(null), ...rest }: Props = $props();
const context = getColorPickerContext();
const parsed = $derived(parseFormattedColor(value));
const selected = $derived(parsed !== undefined && colorToHex(parsed) === colorToHex(context.color));

function onclick(event: MouseEvent): void {
  rest.onclick?.(event as MouseEvent & { currentTarget: EventTarget & HTMLButtonElement });
  if (!event.defaultPrevented && !context.disabled && parsed) context.setColor(parsed);
}
</script>

<button bind:this={ref}
  {...rest}
  type="button"
  aria-label={label}
  aria-pressed={selected}
  disabled={context.disabled || !parsed}
  data-color={parsed ? colorToHex(parsed) : undefined}
  data-state={selected ? 'selected' : 'unselected'}
  onclick={onclick}
></button>

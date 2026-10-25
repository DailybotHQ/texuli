<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import { type ColorFormat, formatColor, parseColor, parseFormattedColor } from './color.ts';
import { setColorPickerContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  format?: ColorFormat;
  disabled?: boolean;
  label?: string;
  children?: Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
};

let {
  value = $bindable(),
  defaultValue = '#3b82f6',
  onValueChange,
  format = $bindable(),
  disabled = false,
  label = 'Choose color',
  children,
  child,
  ...rest
}: Props = $props();

const valueControlled = value !== undefined;
// svelte-ignore state_referenced_locally
let localColor = $state(parseColor(defaultValue) ?? { l: 0.55, c: 0.18, h: 250, a: 1 });

const color = $derived(
  valueControlled ? (parseFormattedColor(value ?? '') ?? localColor) : localColor
);
const activeFormat = $derived(format ?? 'hex');
const formattedValue = $derived(valueControlled ? (value ?? '') : formatColor(color, activeFormat));

function setColor(next: typeof color): void {
  const nextValue = formatColor(next, activeFormat);
  if (valueControlled) value = nextValue;
  else localColor = next;
  onValueChange?.(nextValue);
}

setColorPickerContext({
  get color() {
    return color;
  },
  get value() {
    return formattedValue;
  },
  get format() {
    return activeFormat;
  },
  get disabled() {
    return disabled;
  },
  setColor,
});

const attrs = $derived({
  ...rest,
  role: 'group' as const,
  'aria-label': label,
});
</script>

{#if child}
  {@render child({ props: attrs as Record<string, unknown> })}
{:else}
  <div {...attrs}>{@render children?.()}</div>
{/if}

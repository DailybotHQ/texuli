<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements';
import { parseFormattedColor } from './color.ts';
import { getColorPickerContext } from './context.ts';

type Props = Omit<HTMLInputAttributes, 'type' | 'value' | 'oninput'> & {
  label?: string;
};

let { label = 'Color value', ...rest }: Props = $props();
const context = getColorPickerContext();
let draft = $state(context.value);
const valid = $derived(parseFormattedColor(draft) !== undefined);

$effect(() => {
  draft = context.value;
});

function oninput(event: Event): void {
  draft = (event.currentTarget as HTMLInputElement).value;
  const parsed = parseFormattedColor(draft);
  if (parsed) context.setColor(parsed);
}
</script>

<input
  {...rest}
  type="text"
  value={draft}
  aria-label={label}
  aria-invalid={valid ? undefined : 'true'}
  disabled={context.disabled}
  data-state={valid ? 'valid' : 'invalid'}
  oninput={oninput}
/>

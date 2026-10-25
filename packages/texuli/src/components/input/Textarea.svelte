<script lang="ts">
import type { HTMLTextareaAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { autosizeTextarea } from './autosize.ts';
import { fieldVariants } from './field-classes.ts';
import './field.css';

type Props = Omit<HTMLTextareaAttributes, 'value' | 'class'> & {
  class?: ClassValue;
  value?: string;
  /** Element ref for the native textarea (bindable). */
  ref?: HTMLElement | null;
  /** Grow with content (disables manual resize). */
  autosize?: boolean;
  onValueChange?: (value: string) => void;
};

let {
  class: className,
  value = $bindable(''),
  ref = $bindable(null),
  autosize = false,
  disabled = false,
  readonly = false,
  rows = 3,
  onValueChange,
  ...rest
}: Props = $props();

const classes = $derived(fieldVariants({ control: 'textarea', class: className }));

$effect(() => {
  // Track value so height updates when the owner sets it.
  void value;
  if (autosize) autosizeTextarea(ref as HTMLTextAreaElement | null);
});

function onInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
  value = event.currentTarget.value;
  onValueChange?.(value);
  if (autosize) autosizeTextarea(event.currentTarget);
}
</script>

<textarea
  bind:this={ref}
  class={cx(classes)}
  {value}
  {disabled}
  {readonly}
  {rows}
  data-tx-textarea=""
  data-tx-autosize={autosize ? 'true' : undefined}
  oninput={onInput}
  {...rest}
></textarea>

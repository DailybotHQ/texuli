<script lang="ts">
import type { HTMLTextareaAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { autosizeTextarea } from './autosize.ts';
import {
  type FieldAppearance,
  type FieldSize,
  fieldAppearance,
  fieldSize,
  fieldVariants,
} from './field-classes.ts';
import './field.css';

type Props = Omit<HTMLTextareaAttributes, 'value' | 'class'> & {
  class?: ClassValue;
  value?: string;
  /** Element ref for the native textarea (bindable). */
  ref?: HTMLElement | null;
  /** Grow with content (disables manual resize). */
  autosize?: boolean;
  onValueChange?: (value: string) => void;
  /**
   * `default` is the bordered control; `plain` drops the control chrome
   * (border, fill, shadow, inline padding, resize handle) for inline-edit
   * bodies. Focus stays visible as an outline.
   */
  appearance?: FieldAppearance;
  /** Text size: `control` (default) or a type-scale size, as on Input (`textSize`, so the native `size` stays). */
  textSize?: FieldSize;
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
  appearance: appearanceProp = 'default',
  textSize: textSizeProp = 'control',
  oninput,
  ...rest
}: Props = $props();

const appearance = $derived(fieldAppearance(appearanceProp));
const textSize = $derived(fieldSize(textSizeProp));
const classes = $derived(
  fieldVariants({
    control: 'textarea',
    class: [appearance === 'plain' ? 'tx-field--plain' : undefined, className],
  })
);

$effect(() => {
  // Track value so height updates when the owner sets it.
  void value;
  if (autosize) autosizeTextarea(ref as HTMLTextAreaElement | null);
});

/** Sync `value` first, then run the caller's `oninput` (it never replaces this one). */
function onInput(event: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
  value = event.currentTarget.value;
  onValueChange?.(value);
  if (autosize) autosizeTextarea(event.currentTarget);
  oninput?.(event as Parameters<NonNullable<typeof oninput>>[0]);
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
  {...rest}
  oninput={onInput}
  data-tx-component="textarea"
  data-tx-variant={appearance}
  data-tx-size={textSize}
></textarea>

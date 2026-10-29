<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { fieldVariants } from './field-classes.ts';
import './field.css';

type Props = Omit<HTMLInputAttributes, 'value' | 'files' | 'class' | 'type'> & {
  class?: ClassValue;
  type?: HTMLInputAttributes['type'];
  /**
   * The value (bindable). Text types bind a string. `type="number"` and
   * `type="range"` bind a number, and `null` while the field is empty (G44).
   */
  value?: string | number | null;
  files?: FileList | null;
  /** Element ref for the native input (bindable). */
  ref?: HTMLElement | null;
  /**
   * When true, show a clear control once the value is non-empty.
   * Uses `clearLabel` for the accessible name.
   */
  clearable?: boolean;
  /** Accessible name for the clear control. */
  clearLabel?: string;
  /** Runs on every edit with the field's text (for numeric types too). */
  onValueChange?: (value: string) => void;
  onClear?: () => void;
};

let {
  class: className,
  type = 'text',
  value = $bindable(''),
  files = $bindable(null),
  ref = $bindable(null),
  clearable = false,
  clearLabel = 'Clear',
  disabled = false,
  readonly = false,
  onValueChange,
  onClear,
  oninput,
  onchange,
  ...rest
}: Props = $props();

const classes = $derived(fieldVariants({ control: 'input', class: className }));
const numeric = $derived(type === 'number' || type === 'range');
const showClear = $derived(
  clearable && type !== 'file' && !disabled && !readonly && value !== null && value !== ''
);
/**
 * What the native input shows: numbers as text, `null` as empty. While the
 * field's own text already parses to the bound number ("1.0", "1e3", or an
 * unfinished "1." the browser reports as empty), that text stays: writing
 * `String(value)` back would rewrite it under the caret. An outside change to
 * `value` no longer matches the text, so it replaces it.
 */
const fieldValue = $derived.by(() => {
  const next = value === null || value === undefined ? null : value;
  const node = ref as HTMLInputElement | null;
  if (numeric && node && node.type === type && toValue(node.value) === next) return node.value;
  return next === null ? '' : String(next);
});

/** The bound value for the field's text: numeric types bind a number or `null`. */
function toValue(text: string): string | number | null {
  if (!numeric) return text;
  if (text.trim() === '') return null;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * The internal handler syncs `value` (so `bind:value` keeps working) and then
 * runs the caller's `oninput`, which sees the updated value. A caller handler
 * never replaces the internal one (G26).
 */
function onInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
  if (type !== 'file') {
    const text = event.currentTarget.value;
    value = toValue(text);
    onValueChange?.(text);
  }
  oninput?.(event as Parameters<NonNullable<typeof oninput>>[0]);
}

/**
 * File inputs: `files` is `null` until the user picks files, and setting it
 * back to `null` (or an empty list) resets the input (G38). A `null` value is
 * never written onto the element: `input.files = null` is ignored by browsers
 * and breaks `input.value` reads in some DOM implementations.
 */
function onFileChange(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
  const picked = event.currentTarget.files;
  files = picked && picked.length > 0 ? picked : null;
}

$effect(() => {
  if (type !== 'file') return;
  const node = ref as HTMLInputElement | null;
  const next = files;
  if (!node) return;
  if (next === null || next === undefined || next.length === 0) {
    if (node.value !== '') node.value = '';
  } else if (node.files !== next) {
    node.files = next;
  }
});

function clear() {
  value = numeric ? null : '';
  onValueChange?.('');
  onClear?.();
  (ref as HTMLInputElement | null)?.focus();
}
</script>

{#if type === 'file'}
  <input
    bind:this={ref}
    type="file"
    class={cx(classes)}
    data-tx-input=""
    {disabled}
    {readonly}
    {...rest}
    onchange={(event) => {
      onFileChange(event);
      onchange?.(event);
    }}
    oninput={onInput}
  />
{:else if clearable}
  <div
    class="tx-input-group"
    data-tx-disabled={disabled ? 'true' : undefined}
    data-tx-input-clearable=""
  >
    <input
      bind:this={ref}
      class={cx('tx-input-group__control', className)}
      {type}
      value={fieldValue}
      {disabled}
      {readonly}
      data-tx-input=""
      {...rest}
      {onchange}
      oninput={onInput}
    />
    {#if showClear}
      <span class="tx-input-group__adornment">
        <button type="button" class="tx-input-clear" aria-label={clearLabel} onclick={clear}>
          ×
        </button>
      </span>
    {/if}
  </div>
{:else}
  <input
    bind:this={ref}
    class={cx(classes)}
    {type}
    value={fieldValue}
    {disabled}
    {readonly}
    data-tx-input=""
    {...rest}
    {onchange}
    oninput={onInput}
  />
{/if}

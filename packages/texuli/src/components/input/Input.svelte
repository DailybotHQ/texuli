<script lang="ts">
import type { HTMLInputAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { fieldVariants } from './field-classes.ts';
import './field.css';

type Props = Omit<HTMLInputAttributes, 'value' | 'files' | 'class' | 'type'> & {
  class?: ClassValue;
  type?: HTMLInputAttributes['type'];
  value?: string;
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
  ...rest
}: Props = $props();

const classes = $derived(fieldVariants({ control: 'input', class: className }));
const showClear = $derived(
  clearable && type !== 'file' && !disabled && !readonly && Boolean(value)
);

function onInput(event: Event & { currentTarget: HTMLInputElement }) {
  if (type === 'file') return;
  value = event.currentTarget.value;
  onValueChange?.(value);
}

function clear() {
  value = '';
  onValueChange?.('');
  onClear?.();
  (ref as HTMLInputElement | null)?.focus();
}
</script>

{#if type === 'file'}
  <input
    bind:this={ref}
    type="file"
    bind:files
    class={cx(classes)}
    data-tx-input=""
    {disabled}
    {readonly}
    {...rest}
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
      {value}
      {disabled}
      {readonly}
      data-tx-input=""
      oninput={onInput}
      {...rest}
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
    {value}
    {disabled}
    {readonly}
    data-tx-input=""
    oninput={onInput}
    {...rest}
  />
{/if}

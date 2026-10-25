<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './field.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  class?: ClassValue;
  /** Start adornment (icon, unit, …). */
  start?: Snippet;
  /** End adornment (icon, button, …). */
  end?: Snippet;
  /** Native input attributes applied to the control. */
  inputProps?: Omit<HTMLInputAttributes, 'value' | 'class' | 'files'>;
  value?: string;
  ref?: HTMLInputElement | null;
  disabled?: boolean;
  readonly?: boolean;
  /** Mark the group invalid (data attribute + aria-invalid on the control). */
  invalid?: boolean;
  clearable?: boolean;
  clearLabel?: string;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  children?: Snippet;
};

let {
  class: className,
  start,
  end,
  inputProps = {},
  value = $bindable(''),
  ref = $bindable(null),
  disabled = false,
  readonly = false,
  invalid = false,
  clearable = false,
  clearLabel = 'Clear',
  onValueChange,
  onClear,
  children,
  ...rest
}: Props = $props();

const showClear = $derived(clearable && !disabled && !readonly && Boolean(value));

function onInput(event: Event & { currentTarget: HTMLInputElement }) {
  value = event.currentTarget.value;
  onValueChange?.(value);
}

function clear() {
  value = '';
  onValueChange?.('');
  onClear?.();
  ref?.focus();
}
</script>

<div
  class={cx('tx-input-group', className)}
  data-tx-input-group=""
  data-tx-disabled={disabled ? 'true' : undefined}
  data-tx-invalid={invalid ? 'true' : undefined}
  {...rest}
>
  {#if start}
    <span class="tx-input-group__adornment" data-tx-slot="start">
      {@render start()}
    </span>
  {/if}

  {#if children}
    {@render children()}
  {:else}
    <input
      bind:this={ref}
      class="tx-input-group__control"
      {value}
      {disabled}
      {readonly}
      aria-invalid={invalid ? 'true' : undefined}
      data-tx-input=""
      oninput={onInput}
      {...inputProps}
    />
  {/if}

  {#if showClear || end}
    <span class="tx-input-group__adornment" data-tx-slot="end">
      {#if showClear}
        <button type="button" class="tx-input-clear" aria-label={clearLabel} onclick={clear}>
          ×
        </button>
      {/if}
      {#if end}
        {@render end()}
      {/if}
    </span>
  {/if}
</div>

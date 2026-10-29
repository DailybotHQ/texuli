<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { splitControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './field.css';

/**
 * Extra attributes follow the control rule: `id`, `aria-*`, `data-*`, handlers
 * and form attributes reach the input (the focusable control, also `ref`);
 * layout hooks (`style`, `hidden`…) stay on the group. With `children` (a
 * custom control) they all stay on the group.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  class?: ClassValue;
  /** Start adornment (icon, unit, …). */
  start?: Snippet;
  /** End adornment (icon, button, …). */
  end?: Snippet;
  /** Native input attributes applied to the control. */
  inputProps?: Omit<HTMLInputAttributes, 'value' | 'class' | 'files'>;
  value?: string;
  /** The input element (bindable). */
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
  clearLabel: clearLabelProp,
  onValueChange,
  onClear,
  children,
  id,
  ...rest
}: Props = $props();
const msg = useMessages();
const clearLabel = $derived(clearLabelProp ?? msg('texuli.input-group.clear-label', 'Clear'));

const split = $derived(splitControlProps(rest));

const showClear = $derived(clearable && !disabled && !readonly && Boolean(value));

/**
 * Sync `value` first, then run the caller's `oninput` (it never replaces this
 * one): `input` cannot be prevented, and the caller reads the new `value`.
 */
function onInput(event: Event & { currentTarget: EventTarget & HTMLInputElement }) {
  value = event.currentTarget.value;
  onValueChange?.(value);
  const caller = split.control.oninput;
  if (typeof caller === 'function') caller(event);
  inputProps.oninput?.(event as Parameters<NonNullable<typeof inputProps.oninput>>[0]);
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
  {...children ? { ...rest, id } : split.wrapper}
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
      {...split.control}
      {id}
      class="tx-input-group__control"
      {value}
      {disabled}
      {readonly}
      aria-invalid={invalid ? 'true' : (split.control['aria-invalid'] as 'true' | undefined)}
      data-tx-input=""
      {...inputProps}
      oninput={onInput}
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

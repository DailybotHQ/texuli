<script lang="ts">
import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements';
import { splitControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import Input from './Input.svelte';
import Textarea from './Textarea.svelte';
import './field.css';

/**
 * Input or textarea with a remaining-character countdown. The count is
 * always in the accessibility tree (`aria-live="polite"`); it is visually
 * shown while focused once `showAfter` or fewer characters remain.
 *
 * Extra attributes split like every styled form control: `aria-*`, `data-*`
 * and handlers (`on*`) reach the input or textarea, the rest (`style`,
 * `hidden`…) the wrapper. `ref` binds the wrapper root.
 */
type OwnProps = {
  class?: ClassValue;
  value?: string;
  tag?: 'input' | 'textarea';
  type?: HTMLInputAttributes['type'];
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  maxlength?: number;
  /** Show the visible countdown once this many characters remain. */
  showAfter?: number;
  rows?: number;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  invalid?: boolean;
  autosize?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  remainingLabel?: string;
  onValueChange?: (value: string) => void;
  /** The rendered root element, the field wrapper (bindable). */
  ref?: HTMLElement | null;
};

type Props = OwnProps & Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'>;

let {
  class: className,
  value = $bindable(''),
  tag = 'input',
  type = 'text',
  id,
  name,
  label = '',
  placeholder = '',
  maxlength = 256,
  showAfter = 20,
  rows = 3,
  disabled = false,
  readonly = false,
  required = false,
  invalid = false,
  autosize = false,
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
  remainingLabel = 'characters left',
  onValueChange,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const split = $derived(splitControlProps(rest));
const onfocusRest = $derived(split.control.onfocus as ((event: FocusEvent) => void) | undefined);
const onblurRest = $derived(split.control.onblur as ((event: FocusEvent) => void) | undefined);

function handleFocus(event: FocusEvent): void {
  focused = true;
  onfocusRest?.(event);
}

function handleBlur(event: FocusEvent): void {
  focused = false;
  onblurRest?.(event);
}

const uid = $props.id();
const fieldId = $derived(id ?? `tx-text-counter-${uid}`);
const counterId = $derived(`${fieldId}-count`);
let focused = $state(false);

const remaining = $derived(Math.max(0, maxlength - (value?.length ?? 0)));
const showCount = $derived(focused && remaining <= showAfter);
const described = $derived(
  [describedBy, counterId].filter((part) => Boolean(part && String(part).length > 0)).join(' ') ||
    undefined
);

function onInputValue(next: string) {
  const clipped = next.slice(0, maxlength);
  value = clipped;
  onValueChange?.(clipped);
}
</script>

<div
  bind:this={ref}
  {...split.wrapper}
  class={cx('tx-input-shell', className)}
  data-tx-text-counter=""
>
  {#if label}
    <label class="tx-input-shell__label" for={fieldId}>{label}</label>
  {/if}
  <div class="tx-input-shell__control-wrap">
    {#if tag === 'textarea'}
      <Textarea
        id={fieldId}
        {name}
        bind:value
        {placeholder}
        {disabled}
        {readonly}
        {maxlength}
        {rows}
        {autosize}
        required={required || undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={described}
        class="tx-field--with-count"
        onValueChange={onInputValue}
        {...split.control}
        onfocus={handleFocus}
        onblur={handleBlur}
      />
    {:else}
      <Input
        id={fieldId}
        {name}
        {type}
        bind:value
        {placeholder}
        {disabled}
        {readonly}
        {maxlength}
        required={required || undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={described}
        class="tx-field--with-count"
        onValueChange={onInputValue}
        {...split.control}
        onfocus={handleFocus}
        onblur={handleBlur}
      />
    {/if}
    <span
      id={counterId}
      class="tx-input-shell__count"
      data-tx-placement={tag}
      data-tx-visible={showCount ? 'true' : 'false'}
      aria-live="polite"
    >
      {remaining}<span class="tx-sr-only"> {remainingLabel}</span>
    </span>
  </div>
</div>

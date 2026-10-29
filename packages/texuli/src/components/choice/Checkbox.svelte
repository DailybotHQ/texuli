<script lang="ts">
import { Checkbox as CheckboxPrimitive } from '@texuli/primitives/checkbox';
import type { HTMLAttributes } from 'svelte/elements';
import { joinIds, splitRequiredControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type ChoiceSize, choiceControlClass } from './variants.ts';
import './choice.css';

type Props = {
  /** Controlled checked state (`bind:checked`). */
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  defaultIndeterminate?: boolean;
  name?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  /** Visible label wired with `for`. */
  label?: string;
  description?: string;
  size?: ChoiceSize;
  onCheckedChange?: (checked: boolean) => void;
  onIndeterminateChange?: (indeterminate: boolean) => void;
  class?: ClassValue;
  /** The rendered root element (bindable): field wrapper, or the control when unlabeled. */
  ref?: HTMLElement | null;
} & Omit<HTMLAttributes<HTMLDivElement>, 'id'>;

const uid = $props.id();

let {
  checked = $bindable(false),
  defaultChecked = false,
  indeterminate = $bindable(false),
  defaultIndeterminate = false,
  name,
  value = 'on',
  disabled = false,
  required = false,
  id = `tx-checkbox-${uid}`,
  label,
  description,
  size = 'md',
  onCheckedChange,
  onIndeterminateChange,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

// aria-*, data-*, handlers and form attributes name and wire the control;
// layout hooks (style, hidden…) stay on the wrapper.
const split = $derived(splitRequiredControlProps(rest));
// A Field's `aria-required` becomes `required` (the primitive derives the attribute).
const isRequired = $derived(required || split.required);

const controlClass = $derived(
  choiceControlClass({
    size,
    class: label ? undefined : className,
  })
);
</script>

{#snippet box()}
  <CheckboxPrimitive.Root
    {...split.control}
    bind:checked
    bind:indeterminate
    {defaultChecked}
    {defaultIndeterminate}
    {id}
    {name}
    {value}
    {disabled}
    required={isRequired}
    {onCheckedChange}
    {onIndeterminateChange}
    class={controlClass}
    aria-describedby={joinIds(
      description && `${id}-description`,
      split.control['aria-describedby'] as string | undefined
    )}
    data-tx-choice="checkbox"
  >
    {#snippet children({ checked: isChecked, indeterminate: isIndeterminate })}
      {#if isIndeterminate}
        <svg class="tx-choice-control__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        </svg>
      {:else if isChecked}
        <svg class="tx-choice-control__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3.5 8.5 6.5 11.5 12.5 4.5"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {/if}
    {/snippet}
  </CheckboxPrimitive.Root>
{/snippet}

{#if label}
  <div
    bind:this={ref}
    class={cx('tx-choice', className)}
    data-tx-choice-field="checkbox"
    {...split.wrapper}
  >
    <span class="tx-choice__hit">{@render box()}</span>
    <div class="tx-choice__copy">
      <label class="tx-choice__label" for={id}>{label}</label>
      {#if description}
        <p class="tx-choice__description" id="{id}-description">{description}</p>
      {/if}
    </div>
  </div>
{:else}
  <span bind:this={ref} class="tx-choice__solo" data-tx-choice-field="checkbox-solo" {...split.wrapper}>
    {@render box()}
  </span>
{/if}

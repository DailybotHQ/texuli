<script lang="ts">
import { RadioGroup as RadioGroupPrimitive } from '@texuli/primitives/radio-group';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { joinIds, splitControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type ChoiceSize, choiceControlClass } from './variants.ts';
import './choice.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = {
  /** Value submitted when this option is selected. */
  value: string;
  disabled?: boolean;
  id?: string;
  label?: string;
  /**
   * Rich label content rendered inside the `<label>`, so it names the radio
   * the same way. Use it instead of `label` (both render when both are
   * set). Card radios keep `label` and take rich content through `children`.
   */
  labelContent?: Snippet;
  description?: string;
  size?: ChoiceSize;
  /** Card chrome when used inside a card RadioGroup. */
  card?: boolean;
  class?: ClassValue;
  children?: Snippet;
  /** The rendered root: the field wrapper when labeled, the radio when not (bindable). */
  ref?: HTMLElement | null;
} & Omit<HTMLAttributes<HTMLElement>, 'id' | 'class' | 'children'>;

const uid = $props.id();

const txDefaults = designDefaults('choice');
let {
  value,
  disabled = false,
  id = `tx-radio-${uid}`,
  label,
  labelContent,
  description,
  size = txDefaults().size ?? 'md',
  card = false,
  class: className,
  children,
  ref = $bindable(null),
  ...rest
}: Props = $props();

// aria-*, data-*, handlers and form attributes name and wire the radio;
// layout hooks (style, hidden…) stay on the wrapper (on the radio when unlabeled).
const split = $derived(splitControlProps(rest));
const describedBy = $derived(
  joinIds(
    description && `${id}-description`,
    split.control['aria-describedby'] as string | undefined
  )
);

const controlClass = $derived(choiceControlClass({ size, class: 'tx-choice-control--radio' }));
</script>

{#if card && label}
  <label
    bind:this={ref}
    class={cx('tx-radio-card', className)}
    for={id}
    data-tx-choice-field="radio-card"
    {...split.wrapper}
    data-tx-component="radio"
    data-tx-size={size}
  >
    <span class="tx-radio-card__control">
      <RadioGroupPrimitive.Item
        {...split.control}
        {id}
        {value}
        {disabled}
        class={controlClass}
        aria-label={label}
        aria-describedby={describedBy}
        data-tx-choice="radio"
      >
        {#snippet children({ checked })}
          {#if checked}<span class="tx-choice-control__dot"></span>{/if}
        {/snippet}
      </RadioGroupPrimitive.Item>
    </span>
    <div class="tx-choice__copy">
      <span class="tx-choice__label" aria-hidden="true">{label}</span>
      {#if description}
        <p class="tx-choice__description" id="{id}-description">{description}</p>
      {/if}
      {@render children?.()}
    </div>
  </label>
{:else if label || labelContent}
  <div
    bind:this={ref}
    class={cx('tx-choice', className)}
    data-tx-choice-field="radio"
    {...split.wrapper}
    data-tx-component="radio"
    data-tx-size={size}
  >
    <span class="tx-choice__hit">
      <RadioGroupPrimitive.Item
        {...split.control}
        {id}
        {value}
        {disabled}
        class={controlClass}
        aria-describedby={describedBy}
        data-tx-choice="radio"
    data-tx-component="radio"
    data-tx-size={size}
      >
        {#snippet children({ checked })}
          {#if checked}<span class="tx-choice-control__dot"></span>{/if}
        {/snippet}
      </RadioGroupPrimitive.Item>
    </span>
    <div class="tx-choice__copy">
      <label class="tx-choice__label" for={id}>{label}{@render labelContent?.()}</label>
      {#if description}
        <p class="tx-choice__description" id="{id}-description">{description}</p>
      {/if}
    </div>
  </div>
{:else}
  <RadioGroupPrimitive.Item
    bind:ref
    {...split.wrapper}
    {...split.control}
    {id}
    {value}
    {disabled}
    class={cx(controlClass, className)}
    aria-describedby={describedBy}
    data-tx-choice="radio"
  >
    {#snippet children({ checked })}
      {#if checked}<span class="tx-choice-control__dot"></span>{/if}
    {/snippet}
  </RadioGroupPrimitive.Item>
{/if}

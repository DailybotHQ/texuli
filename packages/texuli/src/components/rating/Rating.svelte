<script lang="ts">
import { localizeLabels } from '@texuli/core/i18n';
import { RadioGroup as RadioGroupPrimitive } from '@texuli/primitives/radio-group';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import { cx } from '../../internal/cx.ts';
import {
  clampDisplay,
  DEFAULT_RATING_LABELS,
  formatRatingLabel,
  normalizeMax,
  normalizeValue,
  type RatingLabels,
  ratingSteps,
  starFill,
} from './rating.ts';
import { type RatingSize, type RatingTone, ratingClass } from './variants.ts';
import './rating.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

/**
 * Star rating. As an input it is a radio group (APG): one Tab stop, arrow
 * keys move and select (mirrored in RTL), each star (or half star with
 * `allowHalf`) a labeled radio. As `display`, it shows any value (an average
 * like 4.3) as a labeled image. Ported from Protoyard's StarRating.
 */
type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Selected rating (0 = not rated); bindable. */
  value?: number;
  onValueChange?: (value: number) => void;
  /** Number of stars, 1–10 (default 5). */
  max?: number;
  /** Half-star steps (each star holds two radios). */
  allowHalf?: boolean;
  /** Read-only image of the value, for averages and reviews. */
  display?: boolean;
  /** Selecting the current value again (or Delete/Backspace) clears it. */
  clearable?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  size?: RatingSize;
  tone?: RatingTone;
  /** Visible "3.5 of 5" summary (announced politely when it changes). */
  showValue?: boolean;
  /** Hide the group label visually (assistive tech still reads it). */
  hideLabel?: boolean;
  locale?: string;
  labels?: Partial<RatingLabels>;
};

let {
  value = $bindable(0),
  onValueChange,
  max = 5,
  allowHalf = false,
  display = false,
  clearable = false,
  readonly = false,
  disabled = false,
  required = false,
  name,
  size: sizeProp,
  tone = 'warning',
  showValue = false,
  hideLabel = false,
  locale,
  labels,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('rating');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));
const msg = useMessages();

// Input mode: aria-* and data-* name and wire the radio group (the control);
// handlers stay on the wrapper (the group binds its own, and events bubble),
// as do layout hooks. A consumer aria-label or aria-labelledby replaces the
// visible label's name.
// `onfocus` and `onblur` (which do not bubble) go to the group too.
const toGroup = (key: string) => /^(?:aria-|data-|onfocus$|onblur$)/.test(key);
const controlAttrs = $derived(
  Object.fromEntries(Object.entries(rest).filter(([key]) => toGroup(key)))
);
const wrapperAttrs = $derived(
  Object.fromEntries(Object.entries(rest).filter(([key]) => !toGroup(key)))
);
const consumerNamed = $derived('aria-label' in rest || 'aria-labelledby' in rest);

const uid = $props.id();
const text = $derived({
  ...localizeLabels(msg, 'texuli.rating', DEFAULT_RATING_LABELS),
  ...labels,
});
const count = $derived(normalizeMax(max));
const stars = $derived(Array.from({ length: count }, (_, i) => i + 1));
const current = $derived(
  display ? clampDisplay(value, count) : normalizeValue(value, count, allowHalf)
);
let hover = $state<number | null>(null);
const shown = $derived(hover ?? current);
const summary = $derived(
  current > 0 ? formatRatingLabel(text.summary, { value: current, max: count }, locale) : text.none
);
const classes = $derived(
  cx(
    ratingClass({ size, tone }),
    allowHalf && !display && 'tx-rating--half',
    display && 'tx-rating--display',
    className
  )
);
const itemLabel = (step: number) =>
  formatRatingLabel(text.item, { value: step, max: count }, locale);

function choose(next: number): void {
  if (disabled || readonly || display) return;
  const normalized = normalizeValue(next, count, allowHalf);
  if (normalized === current) return;
  value = normalized;
  onValueChange?.(normalized);
}

// Clearing: remember the value when a press starts. In a browser the press
// focuses the radio and the group selects on focus before the click, so the
// value is read at pointerdown; a click with no pointer (assistive tech)
// reads it at click capture. A click on the star that already held the
// value clears it.
let pressedFrom: number | null = null;
function onpointerdowncapture() {
  pressedFrom = current;
}
function onclickcapture() {
  pressedFrom ??= current;
}
function onclick(event: MouseEvent) {
  const from = pressedFrom;
  pressedFrom = null;
  const target = (event.target as Element | null)?.closest('[role="radio"]');
  if (!clearable || !target || from === null || from === 0) return;
  if (Number(target.getAttribute('data-value')) === from && current === from) choose(0);
}
function onkeydown(event: KeyboardEvent) {
  if (!clearable || (event.key !== 'Delete' && event.key !== 'Backspace') || current === 0) return;
  event.preventDefault();
  choose(0);
}
const onpointerleave = () => (hover = null);
</script>

{#snippet star(fill: number)}
  <svg class="tx-rating__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path class="tx-rating__outline" d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
  </svg>
  {#if fill > 0}
    <span class="tx-rating__fill" style:inline-size={`${fill * 100}%`} data-fill={fill}>
      <svg class="tx-rating__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" />
      </svg>
    </span>
  {/if}
{/snippet}

{#if display}
  <div
    bind:this={ref}
    {...rest}
    class={classes}
    role="img"
    aria-label={(rest['aria-label'] as string | undefined) ??
      formatRatingLabel(text.display, { value: current, max: count }, locale)}
    data-tx-rating="display"
  >
    <span class="tx-rating__stars">
      {#each stars as index (index)}
        <span class="tx-rating__star">{@render star(starFill(current, index))}</span>
      {/each}
    </span>
    {#if showValue}<span class="tx-rating__value" aria-hidden="true">{summary}</span>{/if}
  </div>
{:else}
  <div bind:this={ref} {...wrapperAttrs} class={classes} data-tx-rating="input" data-disabled={disabled ? '' : undefined}>
    <span class={cx('tx-rating__label', hideLabel && 'tx-rating__label--hidden')} id={`${uid}-label`}>{text.label}</span>
    <RadioGroupPrimitive.Root
      {...controlAttrs}
      value={current > 0 ? String(current) : ''}
      onValueChange={(next) => choose(Number(next))}
      orientation="horizontal"
      loop={false}
      {name}
      {required}
      {disabled}
      {readonly}
      class="tx-rating__stars"
      aria-labelledby={consumerNamed
        ? (controlAttrs['aria-labelledby'] as string | undefined)
        : `${uid}-label`}
      {onpointerdowncapture}
      {onclickcapture}
      {onclick}
      {onkeydown}
      {onpointerleave}
    >
      {#each stars as index (index)}
        <span class="tx-rating__star" data-star={index}>
          {@render star(starFill(shown, index))}
          {#each ratingSteps(count, allowHalf).filter((step) => Math.ceil(step) === index) as step (step)}
            <RadioGroupPrimitive.Item
              value={String(step)}
              class={cx(
                'tx-rating__hit',
                allowHalf ? (step % 1 === 0 ? 'tx-rating__hit--end' : 'tx-rating__hit--start') : 'tx-rating__hit--full'
              )}
              aria-label={itemLabel(step)}
              onpointerenter={(event: PointerEvent) => {
                if (event.pointerType === 'mouse' && !disabled && !readonly) hover = step;
              }}
            />
          {/each}
        </span>
      {/each}
    </RadioGroupPrimitive.Root>
    {#if showValue}<output class="tx-rating__value" aria-live="polite">{summary}</output>{/if}
  </div>
{/if}

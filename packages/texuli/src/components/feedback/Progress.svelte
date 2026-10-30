<script lang="ts">
import { Progress as ProgressPrimitive } from '@texuli/primitives/progress';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../../i18n/use-messages.ts';
import {
  type FeedbackSize,
  type FeedbackTone,
  type ProgressShape,
  progressClass,
} from './variants.ts';
import './feedback.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Current value; `null` is indeterminate. */
  value?: number | null;
  max?: number;
  min?: number;
  /** Visible label (also names the progressbar). */
  label?: string;
  /** Accessible name when no visible label is shown. */
  ariaLabel?: string;
  /** Show the percent (or loading word) next to the label / in the circle center. */
  showValue?: boolean;
  tone?: FeedbackTone;
  size?: FeedbackSize;
  shape?: ProgressShape;
  /** Spoken word while indeterminate (translatable). */
  loadingLabel?: string;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

const CIRCLE_R = 42;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

let {
  value = 0,
  max = 100,
  min = 0,
  label,
  ariaLabel,
  showValue = false,
  tone = 'primary',
  size = 'md',
  shape = 'linear',
  loadingLabel: loadingLabelProp,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const loadingLabel = $derived(loadingLabelProp ?? msg('texuli.progress.loading-label', 'Loading'));

const uid = $props.id();
const labelId = `tx-progress-label-${uid}`;

const indeterminate = $derived(value === null);
const range = $derived(max - min);
const clamped = $derived(
  indeterminate
    ? null
    : Math.min(
        max,
        Math.max(min, typeof value === 'number' && Number.isFinite(value) ? value : min)
      )
);
const percent = $derived(
  indeterminate || range <= 0 ? null : Math.round((((clamped as number) - min) / range) * 100)
);
const valueText = $derived(percent === null ? loadingLabel : `${percent}%`);
const offset = $derived(
  percent === null ? CIRCUMFERENCE : CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE
);

const rootClass = $derived(
  progressClass({
    size,
    tone,
    shape,
    class: className,
  })
);

const namedBy = $derived(label ? labelId : undefined);
const name = $derived(label ? undefined : (ariaLabel ?? loadingLabel));

const linearStyle = $derived(indeterminate ? undefined : `--tx-progress-value: ${percent ?? 0}%`);
const circleStyle = $derived(
  indeterminate
    ? `--tx-progress-circumference: ${CIRCUMFERENCE}`
    : `--tx-progress-circumference: ${CIRCUMFERENCE}; --tx-progress-offset: ${offset}`
);
</script>

<div
  bind:this={ref}
  class={rootClass}
  data-tx-progress
  data-shape={shape}
  data-tone={tone}
  data-size={size}
  data-state={indeterminate ? 'indeterminate' : percent === 100 ? 'complete' : 'loading'}
  {...rest}
>
  {#if shape === 'linear'}
    {#if label || (showValue && !indeterminate)}
      <div class="tx-progress__head">
        {#if label}<span class="tx-progress__label" id={labelId}>{label}</span>{/if}
        {#if showValue && percent !== null}
          <span class="tx-progress__value" data-tx-progress-value>{percent}%</span>
        {/if}
      </div>
    {/if}
    <ProgressPrimitive.Root
      {value}
      {max}
      {min}
      aria-labelledby={namedBy}
      aria-label={name}
      aria-valuetext={valueText}
      class="tx-progress__track"
      data-tx-progress-track
    >
      <div
        class={[
          'tx-progress__indicator',
          indeterminate && 'tx-progress__indicator--indeterminate',
        ]}
        style={linearStyle}
        data-tx-progress-indicator
      ></div>
    </ProgressPrimitive.Root>
  {:else}
    <div class="tx-progress__circle-wrap">
      <ProgressPrimitive.Root
        {value}
        {max}
        {min}
        aria-labelledby={namedBy}
        aria-label={name}
        aria-valuetext={valueText}
        class="tx-progress__circle-host"
        data-tx-progress-track
      >
        <svg
          class="tx-progress__circle"
          viewBox="0 0 100 100"
          aria-hidden="true"
          style={circleStyle}
        >
          <circle class="tx-progress__circle-track" cx="50" cy="50" r={CIRCLE_R} />
          <circle
            class={[
              'tx-progress__circle-meter',
              indeterminate && 'tx-progress__circle-meter--indeterminate',
            ]}
            cx="50"
            cy="50"
            r={CIRCLE_R}
            data-tx-progress-indicator
          />
        </svg>
      </ProgressPrimitive.Root>
      {#if showValue}
        <span class="tx-progress__circle-center" data-tx-progress-value aria-hidden="true">
          {valueText}
        </span>
      {/if}
    </div>
    {#if label}
      <span class="tx-progress__label" id={labelId}>{label}</span>
    {/if}
  {/if}
</div>

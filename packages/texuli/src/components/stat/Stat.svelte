<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
import TrendIcon from './TrendIcon.svelte';
import {
  formatDelta,
  type PositiveDirection,
  resolveTrend,
  type Trend,
  trendToneClass,
  trendWord,
} from './trend.ts';
import './stat.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  /** Metric name (visible + accessible). */
  label: string;
  /** Primary value (pre-formatted string or number). */
  value: string | number;
  /** Change vs. the previous period, e.g. "+12%" or 12 (numbers get a sign). */
  delta?: string | number;
  /** Defaults to the sign of a numeric delta. */
  trend?: Trend;
  /** Which direction is good; `down` suits churn or latency. */
  positive?: PositiveDirection;
  /** Secondary copy after the delta (period label, etc.). */
  hint?: string;
  /** Decorative icon (wrapped aria-hidden). */
  icon?: Snippet;
  /** Optional sparkline / mini chart under the meta row. */
  sparkline?: Snippet;
  /** Surface elevation. */
  variant?: 'elevated' | 'flat';
};

const statClass = variants({
  base: 'tx-stat',
  variants: {
    variant: {
      elevated: '',
      flat: 'tx-stat--flat',
    },
  },
  defaultVariants: { variant: 'elevated' },
});

const txDefaults = designDefaults('stat');
let {
  label,
  value,
  delta,
  trend,
  positive = 'up',
  hint,
  icon,
  sparkline,
  variant = txDefaults().variant ?? 'elevated',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const resolvedTrend = $derived(resolveTrend(delta, trend));
const deltaText = $derived(formatDelta(delta));
const tone = $derived(trendToneClass(resolvedTrend, positive));
const word = $derived(trendWord(resolvedTrend));
</script>

<article
  bind:this={ref}
  class={statClass({
    variant,
    class: className,
  })}
  data-tx-stat
  data-variant={variant}
  data-trend={resolvedTrend}
  {...rest}
>
  <div class="tx-stat__head">
    <p class="tx-stat__label" data-tx-stat-label>{label}</p>
    {#if icon}
      <span class="tx-stat__icon" aria-hidden="true" data-tx-stat-icon>{@render icon()}</span>
    {/if}
  </div>
  <p class="tx-stat__value" data-tx-stat-value>{value}</p>
  {#if deltaText !== undefined || hint}
    <div class="tx-stat__meta" data-tx-stat-meta>
      {#if deltaText !== undefined}
        <span class={cx('tx-stat__delta', tone)} data-tx-stat-delta data-trend={resolvedTrend}>
          <TrendIcon trend={resolvedTrend} />
          <span class="tx-sr-only">{word}:</span>
          {deltaText}
        </span>
      {/if}
      {#if hint}
        <span class="tx-stat__hint" data-tx-stat-hint>{hint}</span>
      {/if}
    </div>
  {/if}
  {#if sparkline}
    <div class="tx-stat__spark" data-tx-stat-spark>{@render sparkline()}</div>
  {/if}
</article>

<script lang="ts">
import { type HrefTrust, safeHref } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
import { formatKpi, type KpiUnit, kpiDelta } from './format.ts';
import TrendIcon from './TrendIcon.svelte';
import { type PositiveDirection, resolveTrend, trendToneClass, trendWord } from './trend.ts';
import './stat.css';

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  label: string;
  value: number | null | undefined;
  unit?: KpiUnit;
  currency?: string;
  /** Comparison value (e.g. previous period); delta is computed from it. */
  previous?: number | null;
  /** Shown after the delta. */
  comparisonLabel?: string;
  /** Which direction is good; `down` suits churn, latency or cost. */
  positive?: PositiveDirection;
  /** Optional sparkline / mini chart (consumer provides chart). */
  sparkline?: Snippet;
  /** Turns the tile into a link to a detail view (URL policy). */
  href?: string;
  hrefTrust?: HrefTrust;
  loading?: boolean;
  /** `true` or a message when there is no value yet. */
  empty?: boolean | string;
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

let {
  label,
  value,
  unit = 'number',
  currency = 'USD',
  previous,
  comparisonLabel = 'vs previous period',
  positive = 'up',
  sparkline,
  href,
  hrefTrust = 'developer',
  loading = false,
  empty = false,
  variant = 'elevated',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const uid = $props.id();
const change = $derived(kpiDelta(value, previous, unit, currency));
const direction = $derived(resolveTrend(change?.absolute ?? null));
const tone = $derived(trendToneClass(direction, positive));
const word = $derived(trendWord(direction));
const safe = $derived(href === undefined ? undefined : safeHref(href, hrefTrust));
const isEmpty = $derived(!loading && (empty !== false || value === null || value === undefined));
const emptyText = $derived(typeof empty === 'string' ? empty : 'No data yet');
const formatted = $derived(formatKpi(value, unit, currency));
</script>

<article
  bind:this={ref}
  class={statClass({
    variant,
    class: cx(
      safe && 'tx-stat--interactive',
      className
    ),
  })}
  data-tx-kpi
  data-tx-stat
  data-variant={variant}
  data-trend={change ? direction : undefined}
  aria-labelledby="{uid}-label"
  aria-busy={loading ? 'true' : undefined}
  {...rest}
>
  <p class="tx-stat__label" id="{uid}-label" data-tx-stat-label>
    {#if safe}
      <a href={safe} class="tx-stat__label-link" aria-describedby="{uid}-value">{label}</a>
    {:else}
      {label}
    {/if}
  </p>

  {#if loading}
    <div class="tx-stat__skeleton tx-stat__skeleton--value" aria-hidden="true"></div>
    <div class="tx-stat__skeleton tx-stat__skeleton--meta" aria-hidden="true"></div>
  {:else if isEmpty}
    <p
      id="{uid}-value"
      class="tx-stat__value tx-stat__value--empty"
      data-tx-stat-value
    >
      —
    </p>
    <p class="tx-stat__hint" data-tx-stat-empty>{emptyText}</p>
  {:else}
    <p id="{uid}-value" class="tx-stat__value" data-tx-stat-value>{formatted}</p>
    {#if change}
      <p class="tx-stat__meta" data-tx-stat-meta data-kpi-delta={direction}>
        <span class={cx('tx-stat__delta', tone)} data-tx-stat-delta data-trend={direction}>
          <TrendIcon trend={direction} />
          <span class="tx-sr-only">{word}:</span>
          {change.text}
        </span>
        <span class="tx-stat__comparison" data-tx-stat-comparison>{comparisonLabel}</span>
      </p>
    {/if}
    {#if sparkline}
      <div class="tx-stat__spark" data-tx-stat-spark>{@render sparkline()}</div>
    {/if}
  {/if}
</article>

/**
 * Trend semantics shared by Stat and KPI so every metric reads the same:
 * direction from the delta, tone from whether that direction is good, and
 * the word screen readers hear.
 */

export const TRENDS = ['up', 'down', 'neutral'] as const;
export type Trend = (typeof TRENDS)[number];

export const POSITIVE_DIRECTIONS = ['up', 'down'] as const;
export type PositiveDirection = (typeof POSITIVE_DIRECTIONS)[number];

/** The explicit trend, else the sign of a numeric delta (text deltas stay neutral). */
export function resolveTrend(delta?: string | number | null, trend?: Trend): Trend {
  if (trend) return trend;
  return typeof delta === 'number'
    ? delta > 0
      ? 'up'
      : delta < 0
        ? 'down'
        : 'neutral'
    : 'neutral';
}

/**
 * CSS class for the delta tone: success when the trend goes the good way
 * (`positive`), destructive otherwise, muted for neutral.
 */
export function trendToneClass(trend: Trend, positive: PositiveDirection = 'up'): string {
  if (trend === 'neutral') return 'tx-stat__delta--neutral';
  return trend === positive ? 'tx-stat__delta--good' : 'tx-stat__delta--bad';
}

/** Spoken word before the delta: "Increased", "Decreased" or "No change". */
export function trendWord(trend: Trend): string {
  return trend === 'up' ? 'Increased' : trend === 'down' ? 'Decreased' : 'No change';
}

/** A numeric delta with its sign (`+12`); text passes through. */
export function formatDelta(delta: string | number | undefined): string | undefined {
  if (delta === undefined) return undefined;
  return typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta.toLocaleString()}` : delta;
}

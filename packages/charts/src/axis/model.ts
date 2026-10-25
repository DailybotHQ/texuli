import {
  formatCompact,
  formatNumber,
  formatTimeTick,
  type NumberFormatOptions,
  type TimeInterval,
} from '../math/index.ts';

export type AxisValue = string | number;
export type AxisFormatter<T extends AxisValue = AxisValue> = (value: T, index: number) => string;

export interface AxisTick<T extends AxisValue = AxisValue> {
  value: T;
  /** Position in SVG user units from the axis origin. */
  position: number;
}

export interface NumericAxisFormatOptions extends NumberFormatOptions {
  /** Use compact notation for large magnitudes. */
  compact?: boolean;
  /** Tick step for fixed precision labels such as 0.25, 0.50, 0.75. */
  step?: number;
}

/** Stable number formatter for numeric axes; delegates locale and precision to chart math. */
export function formatNumericAxisTick(
  value: number,
  options: NumericAxisFormatOptions = {}
): string {
  if (options.compact) return formatCompact(value, options);
  if (options.step !== undefined) {
    const digits = decimalPlacesForStep(options.step);
    return formatNumber(value, {
      ...options,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }
  return formatNumber(value, options);
}

function decimalPlacesForStep(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  for (let digits = 0; digits <= 12; digits += 1) {
    const scaled = step * 10 ** digits;
    if (Math.abs(scaled - Math.round(scaled)) <= Number.EPSILON * Math.max(1, scaled) * 8) {
      return digits;
    }
  }
  return 12;
}

/** UTC formatter for time axes, using the interval selected by the time scale. */
export function formatTimeAxisTick(
  value: number,
  interval: TimeInterval,
  options: { locale?: string } = {}
): string {
  return formatTimeTick(value, interval, options);
}

/** Default axis formatting preserves categorical labels and formats numbers deterministically. */
export function formatAxisValue(value: AxisValue): string {
  return typeof value === 'number' ? formatNumericAxisTick(value) : value;
}

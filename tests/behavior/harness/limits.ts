/**
 * The behavior suite's absolute limits, as pure functions (no browser).
 *
 * - Every row is a plain assertion: a primitive passes when every row passes.
 * - Size: each primitive's subpath stays within its `texuli.budgets.json` cap
 *   (`pnpm size`); the suite does not measure size itself.
 * - Open-to-focus: the 75th percentile of the samples a row records stays
 *   within the primitive's limit below. Timing is asserted only when
 *   `TEXULI_PERF=1` (a loaded machine must not fail the default suite); the
 *   samples are always written to the results for `limits-cli.ts`.
 */

export const BEHAVIOR_LIMITS = {
  /** A flaky row gets at most this many retries. */
  retries: 2,
} as const;

/** Open-to-focus p75 limit when a primitive has no measured entry (ms). */
export const DEFAULT_OPEN_TO_FOCUS_P75_MS = 150;

/**
 * Measured open-to-focus p75 limits per primitive (ms): the worst p75 across
 * Chromium, WebKit and the Pixel 7, doubled and rounded up to 10 ms, with a
 * 50 ms floor (`limits-cli.ts --measure`). Measured 2026-10-23 on a shared
 * machine at load average ~70: p75 was 1–7 ms everywhere, so every limit is
 * the floor.
 */
export const OPEN_TO_FOCUS_P75_MS: Readonly<Record<string, number>> = {
  'alert-dialog': 50,
  'date-picker': 50,
  dialog: 50,
  'dropdown-menu': 50,
  menu: 50,
  popover: 50,
};

/** The 75th percentile (nearest rank) of a non-empty list of samples. */
export function p75(samples: readonly number[]): number {
  if (samples.length === 0) throw new Error('p75 needs at least one sample');
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.75) - 1] as number;
}

/** The open-to-focus p75 limit for a primitive (ms). */
export function openToFocusLimit(primitive: string): number {
  return OPEN_TO_FOCUS_P75_MS[primitive] ?? DEFAULT_OPEN_TO_FOCUS_P75_MS;
}

export interface OpenToFocusCheck {
  primitive: string;
  p75: number;
  limit: number;
  ok: boolean;
}

/** Checks recorded open-to-focus samples against the primitive's absolute limit. */
export function checkOpenToFocus(primitive: string, samples: readonly number[]): OpenToFocusCheck {
  const value = p75(samples);
  const limit = openToFocusLimit(primitive);
  return { primitive, p75: value, limit, ok: value <= limit };
}

/** Whether wall-clock limits are asserted (`TEXULI_PERF=1`). */
export function perfEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TEXULI_PERF === '1';
}

export interface RowResult {
  id: string;
  passed: boolean;
  /** The failure message, when it failed. */
  error?: string;
}

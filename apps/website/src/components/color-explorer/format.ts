/**
 * Client-safe display helpers for the color explorer island (T-site-perf):
 * no `@texuli/tokens` import, so the island never loads the token engine.
 */

/** A WCAG contrast ratio as text, e.g. `4.52:1`. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

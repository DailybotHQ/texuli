import type { CodeTokenKind } from './tokenizer.ts';

/**
 * Theme roles a token kind may be drawn in. Each one reaches WCAG AA (4.5:1)
 * as text on `surface` (the code background) and on `muted` (a highlighted
 * line) in every library theme, light and dark; `code.test.ts` checks all of
 * them. `secondary` and `accent` are fills, never text, so they are not used.
 */
export const CODE_COLOR_ROLES = [
  'surfaceForeground',
  'mutedForeground',
  'primary',
  'success',
  'info',
  'destructive',
] as const;

export type CodeColorRole = (typeof CODE_COLOR_ROLES)[number];

export interface CodeTokenStyle {
  color: CodeColorRole;
  /** A non-color cue, so kinds differ without color too. */
  emphasis?: 'bold' | 'italic';
}

/** One style per token kind; keywords and tags are also bold, comments italic. */
export const CODE_TOKEN_STYLES: Readonly<Record<CodeTokenKind, CodeTokenStyle>> = Object.freeze({
  plain: { color: 'surfaceForeground' },
  punctuation: { color: 'surfaceForeground' },
  operator: { color: 'surfaceForeground' },
  variable: { color: 'surfaceForeground' },
  property: { color: 'surfaceForeground' },
  keyword: { color: 'primary', emphasis: 'bold' },
  tag: { color: 'primary', emphasis: 'bold' },
  string: { color: 'success' },
  attr: { color: 'success' },
  number: { color: 'destructive' },
  constant: { color: 'destructive' },
  function: { color: 'info' },
  type: { color: 'info' },
  comment: { color: 'mutedForeground', emphasis: 'italic' },
});

/** The CSS class of a token kind (`tx-code-tok--keyword`); plain text has none. */
export function codeTokenClass(kind: CodeTokenKind): string | undefined {
  return kind === 'plain' ? undefined : `tx-code-tok--${kind}`;
}

/**
 * Which highlight step a block shows. An explicit `step` wins. Otherwise a
 * host step (a deck fragment index) counts from the block's own `blockStep`:
 * host step `blockStep + i` shows step `i`, clamped to the first and last.
 * With neither, the first step shows as static emphasis. `-1` means none.
 */
export function activeHighlightIndex(
  stepCount: number,
  step: number | undefined,
  hostStep?: number,
  blockStep = 0
): number {
  if (stepCount <= 0) return -1;
  const clamp = (value: number) => Math.min(stepCount - 1, Math.max(0, Math.floor(value)));
  if (step !== undefined && Number.isFinite(step)) return clamp(step);
  if (hostStep !== undefined && Number.isFinite(hostStep)) return clamp(hostStep - blockStep);
  return 0;
}

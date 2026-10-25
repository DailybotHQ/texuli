import type { BlockTone } from '../core/index.ts';

/**
 * Every visible or announced string the text family renders that does not
 * come from the block itself. Hosts pass translations; English is the default.
 */
export interface TextBlockLabels {
  /** Shown in place of a block that failed validation. */
  invalid: string;
  /** Accessible name of a scrollable code fence. */
  codeBlock: string;
  /** Accessible state of a checked and an open task item. */
  taskDone: string;
  taskOpen: string;
  /** Visible tone label on callouts (not color alone). Empty hides it. */
  tones: Record<BlockTone, string>;
}

export const DEFAULT_TEXT_BLOCK_LABELS: Readonly<TextBlockLabels> = /* @__PURE__ */ Object.freeze({
  invalid: 'This block could not be shown.',
  codeBlock: 'Code block',
  taskDone: 'Done',
  taskOpen: 'Not done',
  tones: /* @__PURE__ */ Object.freeze({
    neutral: '',
    accent: 'Note',
    info: 'Info',
    success: 'Success',
    warning: 'Warning',
    danger: 'Important',
  }),
});

/** Merges host overrides over the English defaults (tones merge per key). */
export function resolveTextBlockLabels(
  overrides: Partial<Omit<TextBlockLabels, 'tones'>> & {
    tones?: Partial<Record<BlockTone, string>>;
  } = {}
): TextBlockLabels {
  const merged = { ...DEFAULT_TEXT_BLOCK_LABELS.tones };
  for (const [tone, label] of Object.entries(overrides.tones ?? {})) {
    if (typeof label === 'string' && tone in merged) merged[tone as BlockTone] = label;
  }
  return {
    invalid: overrides.invalid ?? DEFAULT_TEXT_BLOCK_LABELS.invalid,
    codeBlock: overrides.codeBlock ?? DEFAULT_TEXT_BLOCK_LABELS.codeBlock,
    taskDone: overrides.taskDone ?? DEFAULT_TEXT_BLOCK_LABELS.taskDone,
    taskOpen: overrides.taskOpen ?? DEFAULT_TEXT_BLOCK_LABELS.taskOpen,
    tones: merged,
  };
}

export type TextBlockLabelOverrides = Parameters<typeof resolveTextBlockLabels>[0];

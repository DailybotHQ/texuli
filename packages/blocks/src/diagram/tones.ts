import type { BlockTone } from '../core/schema/vocabulary.ts';

/** Diagram pad around SVG/HTML layout boxes (px). */
export const DIAGRAM_PAD = 16;

/** Map block tones to accent border classes (token colors). */
export const TONE_BORDER: Readonly<Record<BlockTone, string>> = Object.freeze({
  neutral: 'tx-diagram-tone--neutral',
  accent: 'tx-diagram-tone--accent',
  info: 'tx-diagram-tone--info',
  success: 'tx-diagram-tone--success',
  warning: 'tx-diagram-tone--warning',
  danger: 'tx-diagram-tone--danger',
});

export function toneBorder(tone: string | undefined): string {
  if (tone && tone in TONE_BORDER) return TONE_BORDER[tone as BlockTone];
  return TONE_BORDER.neutral;
}

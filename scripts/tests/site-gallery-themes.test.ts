// @vitest-environment node

import type { AaGateModeReport, AaGatePairResult } from '@texuli/tokens/aa-gate';
import { describe, expect, it } from 'vitest';
import {
  filterGalleryByPass,
  filterGalleryCards,
  formatRatio,
  summarizeModeScore,
} from '../../apps/website/src/components/gallery-themes/scores.ts';

function pair(
  partial: Partial<AaGatePairResult> & Pick<AaGatePairResult, 'pairId' | 'kind' | 'ratio' | 'pass'>
): AaGatePairResult {
  return {
    foreground: 'foreground',
    background: 'background',
    state: 'default',
    required: partial.kind === 'text' ? 4.5 : 3,
    ...partial,
  };
}

describe('gallery-themes scores', () => {
  it('summarizes worst text and UI ratios and skips non-hex pairs', () => {
    const mode: AaGateModeReport = {
      mode: 'light',
      pairCount: 4,
      checkedCount: 3,
      skippedCount: 1,
      issueCount: 1,
      pass: false,
      pairs: [
        pair({ pairId: 't1', kind: 'text', ratio: 7.2, pass: true }),
        pair({ pairId: 't2', kind: 'text', ratio: 4.1, pass: false }),
        pair({ pairId: 'u1', kind: 'ui', ratio: 3.5, pass: true }),
        pair({
          pairId: 't3',
          kind: 'text',
          ratio: null,
          pass: true,
          skipped: 'non-hex',
        }),
      ],
      issues: [],
    };
    const summary = summarizeModeScore(mode);
    expect(summary.worstTextRatio).toBeCloseTo(4.1);
    expect(summary.worstUiRatio).toBeCloseTo(3.5);
    expect(summary.pass).toBe(false);
    expect(summary.issueCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
  });

  it('keeps ratios at the precision the card prints', () => {
    const summary = summarizeModeScore({
      mode: 'dark',
      pairCount: 2,
      checkedCount: 2,
      skippedCount: 0,
      issueCount: 0,
      pass: true,
      pairs: [
        pair({ pairId: 't1', kind: 'text', ratio: 5.069492101134923, pass: true }),
        pair({ pairId: 'u1', kind: 'ui', ratio: 3.003285490296784, pass: true }),
      ],
      issues: [],
    });
    expect(summary.worstTextRatio).toBe(5.1);
    expect(summary.worstUiRatio).toBe(3);
    expect(formatRatio(summary.worstTextRatio)).toBe(formatRatio(5.069492101134923));
    expect(formatRatio(summary.worstUiRatio)).toBe('3.0');
  });

  it('formats ratios and filters cards by query and pass', () => {
    expect(formatRatio(5.217)).toBe('5.2');
    expect(formatRatio(null)).toBe('—');
    expect(formatRatio(undefined)).toBe('—');

    const cards = [
      {
        id: 'enterprise-neutral',
        name: 'Enterprise Neutral',
        description: 'Calm greys',
        category: 'builtin',
        collection: 'industry',
        tags: ['neutral'],
        pass: true,
      },
      {
        id: 'violet',
        name: 'Violet',
        description: 'Bold purple',
        category: 'builtin',
        collection: 'brand-like',
        tags: ['bold'],
        pass: false,
      },
    ] as const;

    expect(filterGalleryCards(cards, 'violet').map((c) => c.id)).toEqual(['violet']);
    expect(filterGalleryCards(cards, 'industry neutral').map((c) => c.id)).toEqual([
      'enterprise-neutral',
    ]);
    expect(filterGalleryByPass(cards, 'pass').map((c) => c.id)).toEqual(['enterprise-neutral']);
    expect(filterGalleryByPass(cards, 'fail').map((c) => c.id)).toEqual(['violet']);
    expect(filterGalleryByPass(cards, 'all')).toHaveLength(2);
  });
});

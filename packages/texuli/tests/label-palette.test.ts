import { describe, expect, it } from 'vitest';
import {
  colorRefInk,
  colorRefVar,
  DATA_COLORS,
  isColorRef,
  ROLE_COLORS,
} from '../src/internal/color-ref.ts';

describe('closed label color references', () => {
  it('accepts only registered data and role colors', () => {
    for (const color of [...DATA_COLORS, ...ROLE_COLORS]) expect(isColorRef(color)).toBe(true);

    for (const hostile of [
      '',
      'red',
      '#fff',
      'var(--tx-primary)',
      'url(https://example.com/x)',
      'chart-9',
      'primary; background: url(https://example.com)',
      { toString: () => 'primary' },
      null,
      undefined,
    ]) {
      expect(isColorRef(hostile)).toBe(false);
    }
  });

  it('resolves registered references to token variables and on-color tokens', () => {
    expect(colorRefVar('chart-1')).toBe('var(--tx-chart-1, var(--tx-primary))');
    expect(colorRefVar('chart-8')).toBe('var(--tx-chart-8, var(--tx-chart-3))');
    expect(colorRefInk('chart-1')).toBe('var(--tx-background)');
    expect(colorRefVar('destructive')).toBe('var(--tx-destructive)');
    expect(colorRefInk('destructive')).toBe('var(--tx-destructive-foreground)');
    expect(colorRefVar('neutral')).toBe('var(--tx-muted)');
    expect(colorRefInk('neutral')).toBe('var(--tx-muted-foreground)');
  });
});

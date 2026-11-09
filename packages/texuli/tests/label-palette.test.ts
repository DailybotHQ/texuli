import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Avatar from '../src/components/avatar/Avatar.svelte';
import Badge from '../src/components/badge/Badge.svelte';
import Tag from '../src/components/badge/Tag.svelte';
import {
  colorRefInk,
  colorRefVar,
  DATA_COLORS,
  isCategoryColor,
  isColorRef,
  ROLE_COLORS,
} from '../src/internal/color-ref.ts';

describe('closed label color references', () => {
  it('accepts only registered data and role colors', () => {
    for (const color of [...DATA_COLORS, ...ROLE_COLORS]) expect(isColorRef(color)).toBe(true);
    expect(isCategoryColor('none')).toBe(true);
    expect(isCategoryColor('chart-8')).toBe(true);

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

  it('uses the closed palette on Badge, Avatar and Tag roots', () => {
    const badge = render(Badge, { props: { label: 'Orders', color: 'chart-4' } }).container
      .firstElementChild;
    expect(badge?.getAttribute('data-tx-color')).toBe('chart-4');
    expect(badge?.getAttribute('style')).toContain('--tx-category-fill: var(--tx-chart-4');
    const badgeCss = readFileSync(
      join(process.cwd(), 'packages/texuli/src/components/badge/badge.css'),
      'utf8'
    );
    expect(badgeCss).toContain('font-variant-numeric: tabular-nums;');

    const avatar = render(Avatar, { props: { name: 'Ada Example', color: 'chart-8' } }).container
      .firstElementChild;
    expect(avatar?.getAttribute('data-tx-color')).toBe('chart-8');
    expect(avatar?.getAttribute('style')).toContain('--tx-category-fill: var(--tx-chart-8');

    const tag = render(Tag, { props: { label: 'Logistics', color: 'chart-2' } }).container
      .firstElementChild;
    expect(tag?.getAttribute('data-tx-color')).toBe('chart-2');
    expect(tag?.getAttribute('style')).toContain('--tx-category-ink: var(--tx-background)');

    const unchanged = render(Badge, { props: { label: 'Default', variant: 'success' } }).container
      .firstElementChild;
    expect(unchanged?.hasAttribute('data-tx-color')).toBe(false);
    expect(unchanged?.hasAttribute('style')).toBe(false);
  });

  it('refuses runtime values outside the closed palette without writing CSS', () => {
    const { container } = render(Badge, {
      props: { label: 'Unsafe', color: 'red; background: url(https://example.com)' as never },
    });
    const badge = container.firstElementChild;
    expect(badge?.hasAttribute('data-tx-color')).toBe(false);
    expect(badge?.getAttribute('style') ?? '').not.toContain('red');
  });
});

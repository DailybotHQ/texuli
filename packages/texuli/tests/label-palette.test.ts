import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import { themeVariables } from '@texuli/tokens/css';
import { loadAllFullLibraryThemes } from '@texuli/tokens/library-expand';
import { contrastRatio } from '@texuli/tokens/palette';
import { describe, expect, it } from 'vitest';
import Avatar from '../src/components/avatar/Avatar.svelte';
import Badge from '../src/components/badge/Badge.svelte';
import Tag from '../src/components/badge/Tag.svelte';
import ColorSwatch from '../src/components/typography/ColorSwatch.svelte';
import {
  colorRefInk,
  colorRefVar,
  DATA_COLORS,
  isCategoryColor,
  isColorRef,
  ROLE_COLORS,
} from '../src/internal/color-ref.ts';

const catalog = JSON.parse(
  readFileSync(join(process.cwd(), 'packages/spec/catalog/components.json'), 'utf8')
) as {
  components: {
    id: string;
    axes?: Record<string, { prop: string; default: string; values: string[] }>;
  }[];
};

const colorAxisCases = [
  {
    id: 'badge',
    render: () => render(Badge, { props: { label: 'Status' } }).container.firstElementChild,
  },
  {
    id: 'tag',
    render: () => render(Tag, { props: { label: 'Category' } }).container.firstElementChild,
  },
  {
    id: 'avatar',
    render: () => render(Avatar, { props: { name: 'Ada Example' } }).container.firstElementChild,
  },
  {
    id: 'color-swatch',
    render: () => render(ColorSwatch, { props: { label: 'Primary' } }).container.firstElementChild,
  },
];

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
    expect(colorRefVar('chart-1')).toBe('var(--tx-chart-1, #4f46e5)');
    expect(colorRefVar('chart-8')).toBe('var(--tx-chart-8, #0f766e)');
    expect(colorRefInk('chart-1')).toBe('var(--tx-chart-1-foreground, #ffffff)');
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
    expect(tag?.getAttribute('style')).toContain(
      '--tx-category-ink: var(--tx-chart-2-foreground, #0a0a0a)'
    );

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

  it('keeps category-color ink at AA for every library theme and mode', async () => {
    const themes = await loadAllFullLibraryThemes();
    const fallbackPairs = [
      ['#4f46e5', '#ffffff'],
      ['#0ea5e9', '#0a0a0a'],
      ['#f59e0b', '#0a0a0a'],
      ['#10b981', '#0a0a0a'],
      ['#ec4899', '#0a0a0a'],
      ['#7c3aed', '#ffffff'],
      ['#64748b', '#ffffff'],
      ['#0f766e', '#ffffff'],
    ] as const;

    for (const theme of themes) {
      for (const mode of ['light', 'dark'] as const) {
        const vars = themeVariables({ theme, mode });
        DATA_COLORS.forEach((color, index) => {
          const [fallbackFill, fallbackInk] = fallbackPairs[
            index
          ] as (typeof fallbackPairs)[number];
          const fill = vars[`--tx-${color}`] ?? fallbackFill;
          const ink = vars[`--tx-${color}-foreground`] ?? fallbackInk;
          expect(fill, `${theme.id} ${mode} ${color} fill`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(ink, `${theme.id} ${mode} ${color} foreground`).toMatch(/^#[0-9a-f]{6}$/i);
          expect(
            contrastRatio(ink as string, fill as string),
            `${theme.id} ${mode} ${color}`
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }, 60_000);

  it.each(colorAxisCases)(
    '$id renders the default declared by the catalog color axis',
    ({ id, render: renderCase }) => {
      const axis = catalog.components.find((component) => component.id === id)?.axes?.color;
      expect(axis?.prop).toBe('color');
      expect(axis?.default).toBeDefined();

      const root = renderCase();
      expect(root?.getAttribute('data-tx-color') ?? 'none').toBe(axis?.default);
      if (id === 'color-swatch') {
        expect(root?.getAttribute('style')).toContain('--tx-swatch-fill: var(--tx-primary)');
      }
    }
  );
});

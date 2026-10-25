import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { formatKpi, kpiDelta } from '../src/components/stat/format.ts';
import Kpi from '../src/components/stat/Kpi.svelte';
import KpiRow from '../src/components/stat/KpiRow.svelte';
import Stat from '../src/components/stat/Stat.svelte';
import {
  formatDelta,
  resolveTrend,
  trendToneClass,
  trendWord,
} from '../src/components/stat/trend.ts';

afterEach(cleanup);

describe('trend helpers', () => {
  it('resolves trend from numeric delta or explicit prop', () => {
    expect(resolveTrend(12)).toBe('up');
    expect(resolveTrend(-3)).toBe('down');
    expect(resolveTrend(0)).toBe('neutral');
    expect(resolveTrend('+12%')).toBe('neutral');
    expect(resolveTrend(12, 'down')).toBe('down');
  });

  it('formats deltas and tones by whether the direction is good', () => {
    expect(formatDelta(12)).toBe('+12');
    expect(formatDelta(-0.4)).toBe('-0.4');
    expect(formatDelta('+5%')).toBe('+5%');
    expect(trendWord('up')).toBe('Increased');
    expect(trendToneClass('down', 'down')).toBe('tx-stat__delta--good');
    expect(trendToneClass('up', 'down')).toBe('tx-stat__delta--bad');
    expect(trendToneClass('neutral')).toBe('tx-stat__delta--neutral');
  });
});

describe('formatKpi / kpiDelta', () => {
  it('formats units and period deltas', () => {
    expect(formatKpi(1234.5)).toBe('1,234.5');
    expect(formatKpi(0.124, 'percent')).toMatch(/%/);
    expect(formatKpi(12_500, 'cents')).toMatch(/\$/);
    expect(formatKpi(null)).toBe('—');

    const delta = kpiDelta(120, 100);
    expect(delta?.absolute).toBe(20);
    expect(delta?.relative).toBeCloseTo(0.2);
    expect(delta?.text).toMatch(/\+/);

    expect(kpiDelta(10, null)).toBeNull();
  });
});

describe('Stat', () => {
  it('renders label, value and good down-delta for churn-like metrics', () => {
    const view = render(Stat, {
      props: {
        label: 'Churn',
        value: '2.1%',
        delta: -0.4,
        positive: 'down',
      },
    });
    expect(view.getByText('Churn')).toBeTruthy();
    expect(view.getByText('2.1%')).toBeTruthy();
    const delta = view.container.querySelector('[data-tx-stat-delta]');
    expect(delta?.textContent).toContain('-0.4');
    expect(delta?.textContent).toContain('Decreased');
    expect(delta?.className).toContain('tx-stat__delta--good');
    expect(view.container.querySelector('[data-tx-stat]')?.getAttribute('data-trend')).toBe('down');
  });

  it('supports icon and sparkline slots and flat variant', () => {
    const icon = createRawSnippet(() => ({
      render: () => '<span data-custom-icon>★</span>',
    }));
    const sparkline = createRawSnippet(() => ({
      render: () => '<svg data-spark viewBox="0 0 40 12"><path d="M0 10 L40 2"/></svg>',
    }));
    const view = render(Stat, {
      props: {
        label: 'Signups',
        value: 420,
        delta: '+12%',
        trend: 'up',
        hint: 'vs last week',
        variant: 'flat',
        icon,
        sparkline,
      },
    });
    expect(view.container.querySelector('[data-variant="flat"]')).toBeTruthy();
    expect(view.container.querySelector('[data-custom-icon]')).toBeTruthy();
    expect(view.container.querySelector('[data-spark]')).toBeTruthy();
    expect(view.getByText('vs last week')).toBeTruthy();
  });
});

describe('Kpi', () => {
  it('computes comparison delta and applies positive-down tone', () => {
    const view = render(Kpi, {
      props: {
        label: 'Churn',
        value: 0.031,
        previous: 0.04,
        unit: 'percent',
        positive: 'down',
      },
    });
    expect(view.getByText('Churn')).toBeTruthy();
    const delta = view.container.querySelector('[data-tx-stat-delta]');
    expect(delta?.className).toContain('tx-stat__delta--good');
    expect(view.container.querySelector('[data-kpi-delta="down"]')).toBeTruthy();
    expect(view.getByText('vs previous period')).toBeTruthy();
  });

  it('links through URL policy and rejects unsafe schemes', () => {
    const ok = render(Kpi, {
      props: {
        label: 'Signups',
        value: 120,
        href: 'https://example.com/insights/signups',
      },
    });
    const link = ok.getByRole('link', { name: 'Signups' });
    expect(link.getAttribute('href')).toBe('https://example.com/insights/signups');
    ok.unmount();

    const bad = render(Kpi, {
      props: { label: 'Nope', value: 1, href: 'javascript:alert(1)' },
    });
    expect(bad.container.querySelector('a')).toBeNull();
  });

  it('shows loading skeleton and empty state', () => {
    const loading = render(Kpi, {
      props: { label: 'MRR', value: 100, loading: true },
    });
    expect(loading.container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(loading.container.querySelector('.tx-stat__skeleton')).toBeTruthy();
    loading.unmount();

    const empty = render(Kpi, {
      props: { label: 'MRR', value: null, empty: 'No revenue yet' },
    });
    expect(empty.getByText('—')).toBeTruthy();
    expect(empty.getByText('No revenue yet')).toBeTruthy();
  });
});

describe('KpiRow', () => {
  it('builds an auto-fit row with a safe min width', () => {
    const child = createRawSnippet(() => ({
      render: () => '<div data-tile>1</div>',
    }));
    const view = render(KpiRow, {
      props: {
        label: 'Key metrics',
        minItemWidth: '10rem',
        children: child,
      },
    });
    const row = view.container.querySelector('[data-tx-kpi-row]');
    expect(row?.getAttribute('aria-label')).toBe('Key metrics');
    expect(row?.getAttribute('style')).toContain('--tx-kpi-row-min: 10rem');
    expect(view.container.querySelector('[data-tile]')).toBeTruthy();
  });

  it('rejects unsafe minItemWidth lengths', () => {
    const view = render(KpiRow, {
      props: {
        label: 'Safe',
        minItemWidth: '12rem; color: red',
        children: createRawSnippet(() => ({ render: () => '<span/>' })),
      },
    });
    expect(view.container.querySelector('[data-tx-kpi-row]')?.getAttribute('style')).toContain(
      '--tx-kpi-row-min: 12rem'
    );
  });
});

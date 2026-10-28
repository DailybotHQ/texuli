import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BulletChart from '../src/compact/BulletChart.svelte';
import Gauge from '../src/compact/Gauge.svelte';
import ProgressRing from '../src/compact/ProgressRing.svelte';
import Sparkline from '../src/compact/Sparkline.svelte';
import { gaugeLabelSizes } from '../src/math/layout/gauge.ts';

afterEach(cleanup);

describe('compact charts', () => {
  it('describes a sparkline and exposes its source values in a table, and 9 related cases', () => {
    {
      // describes a sparkline and exposes its source values in a table
      const { container } = render(Sparkline, {
        props: {
          values: [4, null, 8],
          label: 'Weekly orders',
          period: 'three weeks',
          variant: 'area',
        },
      });
      expect(
        screen.getByRole('img', { name: 'Weekly orders' }).querySelector('desc')?.textContent
      ).toContain('increased');
      expect(container.querySelector('svg desc')?.textContent).toContain('Period: three weeks');
      expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
      expect(container.querySelector('tbody')?.textContent).toContain('No data');
      expect(container.querySelector('path')?.getAttribute('d')).not.toContain('NaN');
    }
    cleanup();
    {
      // clamps bullet values, shows target and provides a table
      const { container } = render(BulletChart, {
        props: {
          label: 'Quarterly revenue',
          value: 120,
          max: 100,
          target: 80,
          ranges: [50, 85],
        },
      });
      expect(
        screen.getByRole('img', { name: 'Quarterly revenue' }).querySelector('desc')?.textContent
      ).toContain('100');
      expect(container.querySelectorAll('[data-range]')).toHaveLength(3);
      expect(container.querySelector('[data-target]')).toBeTruthy();
      expect(container.querySelector('tbody')?.textContent).toContain('80');
    }
    cleanup();
    {
      // renders a gauge with its threshold description and data table
      const { container } = render(Gauge, {
        props: {
          label: 'Service health',
          value: 75,
          thresholds: [60, 80],
          bandLabels: ['Needs attention', 'Good', 'Excellent'],
        },
      });
      expect(
        screen.getByRole('img', { name: 'Service health' }).querySelector('desc')?.textContent
      ).toContain('Good');
      expect(container.querySelectorAll('[data-band]')).toHaveLength(3);
      expect(container.querySelector('tbody')?.textContent).toContain('75');
    }
    cleanup();
    {
      // renders an accessible progress ring with a complete data table
      const { container } = render(ProgressRing, {
        props: { label: 'Build progress', value: 3, max: 4 },
      });
      const image = screen.getByRole('img', { name: 'Build progress' });
      expect(image.querySelector('desc')?.textContent).toContain('75%');
      expect(container.querySelector('[data-progress-arc]')).toBeTruthy();
      expect(container.querySelector('tbody')?.textContent).toContain('75%');
    }
    cleanup();
    {
      // uses the declarative number format in visible and accessible chart text
      const { container } = render(Gauge, {
        props: {
          label: 'Revenue',
          value: 1234.5,
          max: 2000,
          format: { type: 'number', locale: 'en-US', style: 'currency', currency: 'USD' },
        },
      });
      expect(container.querySelector('.value-label')?.textContent).toBe('$1,234.50');
      expect(container.querySelector('svg desc')?.textContent).toContain('$1,234.50');
      expect(container.querySelector('tbody')?.textContent).toContain('$2,000.00');
    }
    cleanup();
    {
      // applies declarative formats in bullet and progress-ring data alternatives
      const bullet = render(BulletChart, {
        props: {
          label: 'Conversion',
          value: 0.25,
          max: 1,
          format: { type: 'number', locale: 'en-US', style: 'percent', maximumFractionDigits: 0 },
        },
      });
      expect(bullet.container.querySelector('tbody')?.textContent).toContain('25%');
      cleanup();
      const ring = render(ProgressRing, {
        props: {
          label: 'Amount',
          value: 1234,
          max: 2000,
          format: {
            type: 'number',
            locale: 'en-US',
            notation: 'compact',
            maximumFractionDigits: 1,
          },
        },
      });
      expect(ring.container.querySelector('tbody')?.textContent).toContain('1.2K');
    }
    cleanup();
    {
      // formats epoch values as dates and safely falls back for invalid format options
      const date = render(Sparkline, {
        props: {
          values: [Date.UTC(2026, 2, 2)],
          label: 'Dates',
          format: { type: 'date', locale: 'en-US', timeZone: 'UTC', dateStyle: 'medium' },
        },
      });
      expect(date.container.querySelector('svg desc')?.textContent).toContain('Mar 2, 2026');
      expect(date.container.querySelector('tbody')?.textContent).toContain('Mar 2, 2026');
      cleanup();
      const fallback = render(ProgressRing, {
        props: {
          label: 'Invalid currency',
          value: 5,
          format: { type: 'number', style: 'currency', currency: 'not-a-code' },
        },
      });
      expect(fallback.container.querySelector('tbody')?.textContent).toContain('5');
    }
    cleanup();
    {
      // allows applications to translate data table controls and headings
      const { container } = render(ProgressRing, {
        props: {
          label: 'Progreso',
          description: 'Mitad completo',
          value: 1,
          max: 2,
          labels: {
            tableSummary: 'Ver tabla',
            measure: 'Medida',
            value: 'Valor',
          },
        },
      });
      expect(container.querySelector('summary')?.textContent).toBe('Ver tabla');
      expect(container.querySelector('svg desc')?.textContent).toBe('Mitad completo');
      expect(container.querySelector('thead')?.textContent).toContain('Medida');
      expect(container.querySelector('thead')?.textContent).toContain('Valor');
    }
    cleanup();
    {
      // handles zero and non-finite values without invalid SVG geometry
      const { container } = render(Sparkline, {
        props: { values: [Number.NaN, null], label: 'Empty trend' },
      });
      expect(container.querySelector('svg desc')?.textContent).toContain('No data');
      expect(container.querySelector('path')?.getAttribute('d')).toBe('');
      cleanup();
      const ring = render(ProgressRing, {
        props: { label: 'Unavailable', value: Number.NaN, max: 0 },
      });
      expect(ring.container.querySelector('svg')?.outerHTML).not.toContain('NaN');
      expect(ring.container.querySelector('[data-progress-arc]')).toBeNull();
      cleanup();
      const gauge = render(Gauge, {
        props: {
          label: 'Unavailable gauge',
          value: Number.NaN,
          min: 0,
          max: 0,
          size: Number.NaN,
          thickness: Number.NaN,
        },
      });
      expect(gauge.container.querySelector('svg')?.outerHTML).not.toContain('NaN');
    }
    cleanup();
    {
      // keeps tight threshold bands visible on the gauge
      // Two thresholds 0.2 apart: the middle band's angular sweep is smaller
      // than its pad angle, and it still must render (the legend/table list it).
      const { container } = render(Gauge, {
        props: {
          label: 'Tight bands',
          value: 60,
          thresholds: [59.9, 60.1],
        },
      });
      const bands = [...container.querySelectorAll('[data-band]')];
      expect(bands).toHaveLength(3);
      for (const band of bands) expect(band.getAttribute('d')).not.toBe('');
    }
  });

  it('formatValue formats visible and accessible values and wins over format', () => {
    const formatValue = (value: number) => `${value} pct`;
    const format = { type: 'number', locale: 'en-US', style: 'currency', currency: 'USD' } as const;
    const cases = [
      { component: Gauge, props: { label: 'Health', value: 92, min: 0, max: 100 } },
      { component: Sparkline, props: { label: 'Uptime', values: [90, 92] } },
      { component: BulletChart, props: { label: 'Progress', value: 92, max: 100 } },
      { component: ProgressRing, props: { label: 'Done', value: 92, max: 100 } },
    ] as const;
    for (const { component, props } of cases) {
      const { container } = render(component as typeof Gauge, {
        props: { ...props, format, formatValue } as never,
      });
      const text = `${container.querySelector('svg desc')?.textContent} ${container.querySelector('table')?.textContent}`;
      expect(text, props.label).toContain('92 pct');
      expect(text, props.label).not.toContain('$');
      cleanup();
    }
  });
});

describe('sparkline large-data limits', () => {
  it('keeps every table row for short series and windows long ones', async () => {
    const short = render(Sparkline, { values: [1, 2, 3], label: 'Short' });
    expect(short.container.querySelector('.table-viewport.windowed')).toBeNull();
    expect(short.container.querySelectorAll('tbody tr')).toHaveLength(3);
    cleanup();

    const values = Array.from({ length: 5_000 }, (_, i) => i);
    const { container } = render(Sparkline, { values, label: 'Requests per minute' });
    const viewport = container.querySelector<HTMLElement>('.table-viewport.windowed');
    if (!viewport) throw new Error('missing windowed viewport');
    expect(viewport.getAttribute('role')).toBe('region');
    expect(viewport.tabIndex).toBe(0);
    const rowIndexes = () =>
      [...container.querySelectorAll('tbody tr[aria-rowindex]')].map((row) =>
        Number(row.getAttribute('aria-rowindex'))
      );
    expect(rowIndexes()[0]).toBe(2);
    expect(rowIndexes().length).toBeLessThan(50);

    viewport.scrollTop = 32 * 2_500;
    await fireEvent.scroll(viewport);
    const after = rowIndexes();
    expect(after.length).toBeLessThan(50);
    // Row 2,501 (aria-rowindex 2,502) is in the window after scrolling.
    expect(after).toContain(2_502);
    expect(container.querySelector('tbody tr[aria-rowindex="2"]')).toBeNull();
  });
});

describe('gauge labels', () => {
  /**
   * The gauge's center labels are readable (quality fix after the Task 77
   * visual review): sized in the SVG's user units, so they scale with the
   * viewBox, instead of `em` sizes that resolved to about 3 px.
   */

  afterEach(cleanup);

  /** The gauge's CSS inline size cap (12rem at a 16 px root): its widest rendering. */
  const RENDERED_PX = 192;
  const px = (units: number, diameter: number) => units * (RENDERED_PX / diameter);

  describe('gauge label sizes', () => {
    it('reads at heading size for the value and body size for the band at units, and 3 related cases', () => {
      // reads at heading size for the value and body size for the band at units
      for (const diameter of [64, 144, 320]) {
        const sizes = gaugeLabelSizes(diameter);
        expect(px(sizes.value.fontSize, diameter), String(diameter)).toBeGreaterThanOrEqual(24);
        expect(px(sizes.band.fontSize, diameter), String(diameter)).toBeGreaterThanOrEqual(12);
        expect(sizes.value.fontSize, String(diameter)).toBeGreaterThan(sizes.band.fontSize);

        cleanup();
      }
      cleanup();
      // keeps both labels inside the ring, the band label below the value
      for (const diameter of [64, 144, 320]) {
        const sizes = gaugeLabelSizes(diameter);
        // The ring's inner edge at the default thickness, as Gauge.svelte draws it.
        const inner = diameter / 2 - 7 - Math.min((diameter / 2 - 7) * 0.6, 12);
        expect(sizes.band.y, String(diameter)).toBeGreaterThan(sizes.value.y);
        expect(sizes.band.y + sizes.band.fontSize * 0.3, String(diameter)).toBeLessThan(inner);
        expect(sizes.value.y - sizes.value.fontSize, String(diameter)).toBeGreaterThan(-inner);
      }
      cleanup();
      {
        // renders both labels with font-size attributes in user units
        const { container } = render(Gauge, {
          props: {
            label: 'Service health',
            value: 75,
            thresholds: [60, 80],
            bandLabels: ['Low', 'Good', 'High'],
          },
        });
        const sizes = gaugeLabelSizes(144);
        const value = container.querySelector('.value-label');
        const band = container.querySelector('.band-label');
        expect(Number(value?.getAttribute('font-size'))).toBeCloseTo(sizes.value.fontSize);
        expect(Number(band?.getAttribute('font-size'))).toBeCloseTo(sizes.band.fontSize);
        expect(band?.textContent).toBe('Good');
      }
      cleanup();
      {
        // never sets a font size in CSS for the labels, which would override the attribute
        // Tests run from the repository root (import.meta.url is not a file URL under happy-dom).
        const source = readFileSync(
          join(process.cwd(), 'packages/charts/src/compact/Gauge.svelte'),
          'utf8'
        );
        for (const name of ['value-label', 'band-label']) {
          const rule = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? '';
          expect(rule, name).not.toMatch(/font-size|font:/);
        }
      }
    });
  });
});

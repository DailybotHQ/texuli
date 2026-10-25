import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Gauge from '../src/compact/Gauge.svelte';
import { gaugeLabelSizes } from '../src/math/layout/gauge.ts';

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
  it.each([64, 144, 320])(
    'reads at heading size for the value and body size for the band at %i units',
    (diameter) => {
      const sizes = gaugeLabelSizes(diameter);
      expect(px(sizes.value.fontSize, diameter)).toBeGreaterThanOrEqual(24);
      expect(px(sizes.band.fontSize, diameter)).toBeGreaterThanOrEqual(12);
      expect(sizes.value.fontSize).toBeGreaterThan(sizes.band.fontSize);
    }
  );

  it('keeps both labels inside the ring, the band label below the value', () => {
    for (const diameter of [64, 144, 320]) {
      const sizes = gaugeLabelSizes(diameter);
      // The ring's inner edge at the default thickness, as Gauge.svelte draws it.
      const inner = diameter / 2 - 7 - Math.min((diameter / 2 - 7) * 0.6, 12);
      expect(sizes.band.y, String(diameter)).toBeGreaterThan(sizes.value.y);
      expect(sizes.band.y + sizes.band.fontSize * 0.3, String(diameter)).toBeLessThan(inner);
      expect(sizes.value.y - sizes.value.fontSize, String(diameter)).toBeGreaterThan(-inner);
    }
  });

  it('renders both labels with font-size attributes in user units', () => {
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
  });

  it('never sets a font size in CSS for the labels, which would override the attribute', () => {
    // Tests run from the repository root (import.meta.url is not a file URL under happy-dom).
    const source = readFileSync(
      join(process.cwd(), 'packages/charts/src/compact/Gauge.svelte'),
      'utf8'
    );
    for (const name of ['value-label', 'band-label']) {
      const rule = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? '';
      expect(rule, name).not.toMatch(/font-size|font:/);
    }
  });
});

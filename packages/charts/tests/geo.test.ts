import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import GeoMap from '../src/geo/GeoMap.svelte';
import GeoPointMap from '../src/geo/GeoPointMap.svelte';
import {
  clampGeoOffset,
  geoCells,
  geoColor,
  geoColorIndex,
  geoValue,
  REGION_TILES,
  WORLD_TILES,
} from '../src/geo/model.ts';

afterEach(cleanup);

describe('bundled geo shapes and layouts', () => {
  it('provides unique region ids and non-overlapping tile positions', () => {
    for (const shape of [REGION_TILES, WORLD_TILES]) {
      expect(new Set(shape.map((tile) => tile.id)).size).toBe(shape.length);
      const positions = shape.map((tile) => `${tile.col}:${tile.row}`);
      expect(new Set(positions).size).toBe(shape.length);
      const cells = geoCells(shape, 560, 320);
      expect(cells).toHaveLength(shape.length);
      for (const cell of cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.x + cell.size).toBeLessThanOrEqual(560);
        expect(cell.y + cell.size).toBeLessThanOrEqual(320);
      }
    }
  });

  it('normalizes invalid values and bounds point offsets', () => {
    expect(geoValue(Number.NaN)).toBeNull();
    expect(geoValue(Number.POSITIVE_INFINITY)).toBeNull();
    expect(geoValue(0)).toBe(0);
    expect(geoColorIndex(null, [1, 2])).toBeNull();
    expect(geoColorIndex(10, [0, 10])).toBe(8);
    expect(geoColorIndex(2, [2, 2])).toBe(4);
    expect(clampGeoOffset(-10)).toBe(-0.4);
    expect(clampGeoOffset(10)).toBe(0.4);
    expect(clampGeoOffset(Number.NaN)).toBe(0);
    expect(geoColor(8)).toContain('--tx-chart-sequential-9');
    // Themes without a sequential palette still get a light-to-strong ramp,
    // not one flat fallback color.
    const strengths = Array.from({ length: 9 }, (_, i) =>
      Number(/ (\d+)%, var\(--tx-background/.exec(geoColor(i))?.[1])
    );
    expect(strengths).toEqual([18, 28, 38, 48, 58, 68, 78, 88, 98]);
    expect(geoColor(0)).toContain('color-mix(in oklab');
  });
});

describe('GeoMap', () => {
  it('shows token-colored regions, missing-data cues, an accessible description and table', async () => {
    const { container } = render(GeoMap, {
      title: 'Revenue by district',
      description: 'Annual revenue in dollars for each district.',
      shape: REGION_TILES,
      data: { 'old-town': 100, 'north-ridge': 30, tidewater: Number.NaN },
    });
    const svg = screen.getByRole('img', { name: /Revenue by district/ });
    expect(svg.querySelector('desc')?.textContent).toContain('Annual revenue');
    expect(container.querySelectorAll('[data-region]')).toHaveLength(REGION_TILES.length);
    expect(
      container.querySelector('[data-region="old-town"] rect')?.getAttribute('fill')
    ).toContain('--tx-chart-');
    expect(
      container.querySelector('[data-region="tidewater"] rect')?.getAttribute('stroke-dasharray')
    ).toBe('3 2');
    await fireEvent.click(screen.getByText('View data table'));
    expect(container.querySelector('table')?.textContent).toContain('Old Town');
    expect(container.querySelector('table')?.textContent).toContain('No data');
    expect(container.querySelectorAll('.legend li')).toHaveLength(9);
  });

  it('defaults to the bundled world shape', () => {
    const { container } = render(GeoMap, {
      title: 'Regional activity',
      description: 'Activity by region.',
      data: {},
    });
    expect(container.querySelectorAll('[data-region]')).toHaveLength(WORLD_TILES.length);
  });
});

describe('GeoPointMap', () => {
  it('plots points on bundled regions and exposes every marker in its table', async () => {
    const { container } = render(GeoPointMap, {
      title: 'Team locations',
      description: 'Quarterly activity by district.',
      shape: REGION_TILES,
      points: [
        { id: 'first', label: 'North team', regionId: 'north-ridge', value: 12 },
        {
          id: 'second',
          label: 'Harbor team',
          regionId: 'harbor-point',
          value: 30,
          offset: { x: 0.2, y: -0.1 },
        },
      ],
    });
    const svg = screen.getByRole('img', { name: /Team locations/ });
    expect(svg.querySelector('desc')?.textContent).toContain('Quarterly activity');
    expect(container.querySelectorAll('[data-point]')).toHaveLength(2);
    expect(container.querySelector('[data-point="second"]')?.getAttribute('r')).toBe('12');
    await fireEvent.click(screen.getByText('View data table'));
    expect(container.querySelector('table')?.textContent).toContain('North team');
    expect(container.querySelector('table')?.textContent).toContain('Harbor Point');
    expect(container.querySelector('table')?.textContent).toContain('30');
  });

  it('does not plot unknown regions but keeps those values in the table', async () => {
    const { container } = render(GeoPointMap, {
      title: 'Locations',
      description: 'Team locations.',
      shape: REGION_TILES,
      points: [{ id: 'outside', label: 'Unknown team', regionId: 'missing', value: 10 }],
    });
    expect(container.querySelectorAll('[data-point]')).toHaveLength(0);
    await fireEvent.click(screen.getByText('View data table'));
    expect(container.querySelector('table')?.textContent).toContain('Unknown team');
    expect(container.querySelector('table')?.textContent).toContain('No data');
  });
});

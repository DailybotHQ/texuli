import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { CHART_TITLE_LEVEL_DEFAULT, chartTitleLevelOf } from '../src/heading/index.ts';
import TitleLevelCharts from './harness/TitleLevelCharts.svelte';

/** The flow, geo and part-whole charts whose title rank their host sets (D-G-020). */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const SOURCES = [
  'flow/FunnelChart.svelte',
  'flow/NetworkGraph.svelte',
  'flow/SankeyChart.svelte',
  'geo/GeoMap.svelte',
  'geo/GeoPointMap.svelte',
  'part-whole/PieChart.svelte',
  'part-whole/SunburstChart.svelte',
  'part-whole/TreemapChart.svelte',
];
const TITLES = [
  'Funnel',
  'Network',
  'Sankey',
  'Geo map',
  'Geo points',
  'Donut',
  'Pie',
  'Sunburst',
  'Treemap',
];

afterEach(() => cleanup());

/** The tag of each chart title, in render order. */
function titleTags(container: HTMLElement): string[] {
  return TITLES.map((title) => {
    const heading = [...container.querySelectorAll('figcaption :is(h1,h2,h3,h4,h5,h6)')].find(
      (el) => el.textContent === title
    );
    return heading?.tagName ?? `missing ${title}`;
  });
}

describe('chart title rank from the host (@texuli/charts/heading, D-G-020)', () => {
  it('titles h3 with no host, at the host rank (clamped to 2-6) under one, and never hard-codes a rank', () => {
    expect(CHART_TITLE_LEVEL_DEFAULT).toBe(3);
    expect([1, 2, 4.7, 6, 9, Number.NaN, '2'].map(chartTitleLevelOf)).toEqual([
      2, 2, 4, 6, 6, 3, 3,
    ]);
    for (const [props, tag] of [
      [{ host: false }, 'H3'],
      [{ level: undefined }, 'H3'],
      [{ level: 2 }, 'H2'],
      [{ level: 4 }, 'H4'],
      [{ level: 1 }, 'H2'],
      [{ level: 12 }, 'H6'],
    ] as const) {
      const { container } = render(TitleLevelCharts, { props });
      expect(titleTags(container), JSON.stringify(props)).toEqual(TITLES.map(() => tag));
      cleanup();
    }
    for (const file of SOURCES) {
      const source = readFileSync(resolve(SRC, file), 'utf8');
      expect(source, file).toContain('chartTitleLevel()');
      expect(source, file).not.toMatch(/<h[1-6][\s>]/u);
      expect(source, file).toMatch(/figcaption :is\(h2, h3, h4, h5, h6\)/u);
    }
  });
});

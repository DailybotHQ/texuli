import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BoxPlotChart from '../../src/statistical/BoxPlotChart.svelte';
import EcdfChart from '../../src/statistical/EcdfChart.svelte';
import {
  createBoxLayout,
  createEcdfLayout,
  createViolinLayout,
  MAX_STAT_GROUPS,
  type StatGroup,
} from '../../src/statistical/model.ts';
import {
  boxSummary,
  ecdf,
  kernelDensity,
  MAX_DENSITY_POINTS,
  MAX_STAT_VALUES,
} from '../../src/statistical/stats.ts';
import ViolinChart from '../../src/statistical/ViolinChart.svelte';
import {
  HOSTILE_LABELS,
  HOSTILE_OPTIONS,
  HOSTILE_VALUES,
  hostileGroups,
  nonFiniteLeaves,
} from './corpus.ts';

afterEach(cleanup);

const layouts = {
  box: createBoxLayout,
  violin: createViolinLayout,
  ecdf: createEcdfLayout,
} as const;

describe('statistical marks against the hostile value corpus', () => {
  it('summarizes and lays out every sample without throwing or leaking non-finite numbers; reads only numbers and keeps sums finite at the largest magnitudes', () => {
    // summarizes and lays out every sample without throwing or leaking non-finite numbers
    for (const sample of HOSTILE_VALUES) {
      const id = `${sample.id} (${sample.title})`;
      const summary = boxSummary(sample.values);
      if (summary !== null) {
        expect(nonFiniteLeaves(summary), id).toEqual([]);
        expect(summary.count, id).toBeLessThanOrEqual(MAX_STAT_VALUES);
      }
      const density = kernelDensity(sample.values);
      expect(density.length, id).toBeLessThanOrEqual(MAX_DENSITY_POINTS);
      expect(nonFiniteLeaves(density), id).toEqual([]);
      const steps = ecdf(sample.values);
      expect(steps.length, id).toBeLessThanOrEqual(MAX_STAT_VALUES);
      expect(
        steps.every((step) => step.p > 0 && step.p <= 1),
        id
      ).toBe(true);
      for (const [name, layout] of Object.entries(layouts)) {
        const result = layout([{ id: 'g', label: 'Group', values: sample.values as never }]);
        expect(nonFiniteLeaves(result), `${name} ${id}`).toEqual([]);
      }
    }
    cleanup();
    {
      // reads only numbers and keeps sums finite at the largest magnitudes
      // strings, booleans and objects with valueOf are dropped
      const wrong = HOSTILE_VALUES.find((sample) => sample.id === 'wrong-types');
      expect(boxSummary(wrong?.values)?.count).toBe(1);
      const extreme = HOSTILE_VALUES.find((sample) => sample.id === 'extreme');
      // 1e308 is past MAX_STAT_MAGNITUDE, so only 0 survives.
      expect(boxSummary(extreme?.values)).toMatchObject({ count: 1, min: 0, max: 0 });
      const wide = boxSummary([-1e300, 1e300]);
      expect(wide?.median).toBe(0);
    }
  });
});

describe('statistical marks against hostile options and groups', () => {
  const groups: StatGroup[] = [
    { id: 'a', label: 'A', values: [1, 2, 3, 4, 50] },
    { id: 'b', label: 'B', values: [2, 2, 3, 5] },
  ];
  it('lays out every family with every hostile option set; drops malformed and duplicate groups, caps the rest, and treats non-arrays as no data', () => {
    // lays out every family with every hostile option set
    for (const [index, options] of HOSTILE_OPTIONS.entries()) {
      for (const [name, layout] of Object.entries(layouts)) {
        const id = `${name} option set ${index} (${JSON.stringify(options)})`;
        const result = layout(groups, options as never);
        expect(nonFiniteLeaves(result), id).toEqual([]);
        expect(result.width, id).toBeGreaterThan(0);
        expect(result.height, id).toBeGreaterThan(0);
      }
    }
    // caps density sampling even when asked for a billion points
    expect(kernelDensity([1, 2, 3], { points: 1e9 })).toHaveLength(MAX_DENSITY_POINTS);
    cleanup();
    // drops malformed and duplicate groups, caps the rest, and treats non-arrays as no data
    for (const [name, layout] of Object.entries(layouts)) {
      const result = layout(hostileGroups() as never);
      const drawn = [...result.marks, ...result.empty];
      expect(drawn.length, name).toBeLessThanOrEqual(MAX_STAT_GROUPS);
      const ids = drawn.map((item) => item.id);
      expect(new Set(ids).size, name).toBe(ids.length);
      expect(ids, name).not.toContain('');
      expect(drawn.find((item) => item.id === 'dup')?.label, name).toBe('First');
      expect(nonFiniteLeaves(result), name).toEqual([]);
    }
    expect(createBoxLayout(null).marks).toEqual([]);
    expect(createViolinLayout(undefined).marks).toEqual([]);
    expect(createEcdfLayout('groups' as never).marks).toEqual([]);
  });
});

describe('statistical components render hostile labels as text', () => {
  const groups = HOSTILE_LABELS.map((label, i) => ({
    id: `g${i}`,
    label,
    values: [i, i + 2, i + 5],
  }));
  const components = [
    ['BoxPlotChart', BoxPlotChart, { groups }],
    ['ViolinChart', ViolinChart, { groups }],
    ['EcdfChart', EcdfChart, { series: groups }],
  ] as const;
  it('never turns a label into markup or a script URL; renders a huge series within a time bound', () => {
    // never turns a label into markup or a script URL
    for (const [name, component, data] of components) {
      const { container, unmount } = render(
        component as never,
        {
          title: HOSTILE_LABELS[0],
          description: HOSTILE_LABELS[1],
          ...data,
        } as never
      );
      expect(container.querySelector('script, img, foreignObject, a, iframe'), name).toBeNull();
      expect(container.querySelector('[onload], [onerror]'), name).toBeNull();
      expect(container.querySelector('svg svg'), name).toBeNull();
      expect(container.textContent, name).toContain('<script>window.__chartHostile = 1</script>');
      expect((globalThis as { __chartHostile?: unknown }).__chartHostile, name).toBeUndefined();
      const geometry = [...container.querySelectorAll('svg [d], svg [x], svg [cx], svg [y1]')]
        .flatMap((node) =>
          ['d', 'x', 'cx', 'cy', 'y', 'x1', 'y1'].map((attr) => node.getAttribute(attr) ?? '')
        )
        .join(' ');
      expect(geometry, name).not.toMatch(/NaN|Infinity/);
      unmount();
    }
    cleanup();
    {
      // renders a huge series within a time bound
      const huge = HOSTILE_VALUES.find((sample) => sample.id === 'huge');
      const started = performance.now();
      const { container } = render(ViolinChart, {
        title: 'Huge',
        description: 'A very long agent series.',
        groups: [{ id: 'h', label: 'Huge', values: huge?.values as number[] }],
      });
      expect(container.querySelectorAll('path.violin')).toHaveLength(1);
      expect(performance.now() - started).toBeLessThan(5_000);
    }
  });
});

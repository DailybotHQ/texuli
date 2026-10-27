/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { compile } from 'svelte/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import Gauge from '../src/compact/Gauge.svelte';
import SankeyChart from '../src/flow/SankeyChart.svelte';
import Tooltip from '../src/interaction/Tooltip.svelte';
import HeatmapChart from '../src/matrix/HeatmapChart.svelte';

afterEach(() => cleanup());

const SRC = resolve(__dirname, '../src');

function svelteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry): string[] => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return svelteFiles(path);
    return entry.name.endsWith('.svelte') ? [path] : [];
  });
}

describe('charts under dir="rtl"', () => {
  it('declares direction="ltr" on every chart SVG (legend icons hold no text), and 3 related cases', () => {
    {
      // declares direction="ltr" on every chart SVG (legend icons hold no text)
      // SVG text-anchor start/end follow the inherited direction, while plot
      // geometry is physical: every chart SVG keeps an LTR coordinate system.
      const missing: string[] = [];
      for (const file of svelteFiles(SRC)) {
        const markup = readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
        for (const match of markup.matchAll(/<svg\b[^>]*>/g)) {
          const tag = match[0];
          if (tag.includes('tx-chart-legend__symbol')) continue;
          if (!/\bdirection="ltr"/.test(tag)) {
            const line = markup.slice(0, match.index).split('\n').length;
            missing.push(`${relative(SRC, file)}:${line}`);
          }
        }
      }
      expect(missing).toEqual([]);
    }
    cleanup();
    {
      // renders LTR plot SVGs for end-anchored axis and node labels
      const heatmap = render(HeatmapChart, {
        props: {
          title: 'Effort',
          description: 'Fictional effort by squad.',
          cells: [{ x: 'Mon', y: 'Design', value: 2 }],
        },
      });
      const sankey = render(SankeyChart, {
        props: {
          title: 'Flow',
          nodes: [{ id: 'a' }, { id: 'b' }],
          links: [{ source: 'a', target: 'b', value: 1 }],
        },
      });
      const gauge = render(Gauge, { props: { label: 'Health', value: 60 } });
      for (const { container } of [heatmap, sankey, gauge]) {
        const svg = container.querySelector('svg[role="img"]');
        expect(svg?.getAttribute('direction')).toBe('ltr');
      }
    }
    cleanup();
    {
      // places the tooltip with physical offsets that match plot coordinates
      const { container } = render(Tooltip, {
        props: {
          anchor: { x: 40, y: 80 },
          bounds: { width: 400, height: 200 },
          children: createRawSnippet(() => ({ render: () => '<span>Fictional value</span>' })),
        },
      });
      const style = container.querySelector('[data-chart-tooltip]')?.getAttribute('style') ?? '';
      // `inset-inline-start` would mirror the tooltip away from its point in RTL.
      expect(style).not.toContain('inline');
      expect(style).toMatch(/(^|;\s*)left:\s*\d/);
    }
    cleanup();
    {
      // keeps the matrix frame styles inside the matrix figure
      const source = readFileSync(join(SRC, 'matrix/MatrixFrame.svelte'), 'utf8');
      const css = compile(source, { filename: 'MatrixFrame.svelte', css: 'external' }).css?.code;
      const leaking = [...(css ?? '').matchAll(/([^{}]+)\{/g)]
        .flatMap((match) => (match[1] ?? '').split(','))
        .map((selector) => selector.trim())
        .filter((selector) => {
          const start = selector.search(/(^|\s)\.chart\b/);
          if (start < 0) return false;
          // The compound selector holding `.chart` must carry the component scope class.
          const compound = selector.slice(start).trim().split(/\s+/)[0] ?? '';
          return !compound.includes('.svelte-');
        });
      // A bare `.chart svg` also matches cartesian and part-whole figures.
      expect(leaking).toEqual([]);
    }
  });
});

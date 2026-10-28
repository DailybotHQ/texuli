import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { barsPaths, Sparkline as SparklineLite } from '../src/sparkline-lite/index.ts';

afterEach(cleanup);

describe('SparklineLite', () => {
  it('draws the trend with an accessible name and derived description, and no data table', () => {
    const { container } = render(SparklineLite, {
      props: { values: [4, null, 8], label: 'Weekly orders', period: 'three weeks' },
    });
    const image = screen.getByRole('img', { name: 'Weekly orders' });
    const desc = image.querySelector('desc')?.textContent ?? '';
    expect(desc).toContain('2 values; increased from 4 to 8.');
    expect(desc).toContain('Period: three weeks.');
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
    const line = container.querySelector('path')?.getAttribute('d') ?? '';
    // The null splits the line into two runs; nothing is NaN.
    expect(line.match(/M/g)).toHaveLength(2);
    expect(line).not.toContain('NaN');
    expect(container.querySelector('[data-marker="last"]')).toBeTruthy();
  });

  it('formats the description with formatValue, then a format spec, and falls back safely', () => {
    render(SparklineLite, {
      props: { values: [1, 2], label: 'Callback', formatValue: (value) => `${value} pts` },
    });
    expect(screen.getByRole('img', { name: 'Callback' }).querySelector('desc')?.textContent).toBe(
      '2 values; increased from 1 pts to 2 pts.'
    );
    render(SparklineLite, {
      props: {
        values: [0.25, 0.5],
        label: 'Spec',
        format: { type: 'number', style: 'percent', locale: 'en-US' },
      },
    });
    expect(screen.getByRole('img', { name: 'Spec' }).querySelector('desc')?.textContent).toBe(
      '2 values; increased from 25% to 50%.'
    );
    render(SparklineLite, {
      props: {
        values: [3, 1],
        label: 'Bad spec',
        format: { type: 'number', style: 'currency', locale: 'en-US' },
      },
    });
    // Currency without a currency code is rejected by Intl: plain numbers instead.
    expect(screen.getByRole('img', { name: 'Bad spec' }).querySelector('desc')?.textContent).toBe(
      '2 values; decreased from 3 to 1.'
    );
    render(SparklineLite, {
      props: {
        values: [0, 1e20],
        label: 'Out of range date',
        format: { type: 'date', locale: 'en-US', timeZone: 'UTC' },
      },
    });
    expect(
      screen.getByRole('img', { name: 'Out of range date' }).querySelector('desc')?.textContent
    ).toContain('to 100,000,000,000,000,000,000.');
  });

  it('uses the given description, labels.noData and showLast', () => {
    const { container } = render(SparklineLite, {
      props: {
        values: [null, null],
        label: 'Empty',
        labels: { noData: 'Sin datos', tableSummary: 'unused' },
        showLast: false,
      },
    });
    expect(screen.getByRole('img', { name: 'Empty' }).querySelector('desc')?.textContent).toBe(
      'Sin datos'
    );
    expect(container.querySelector('[data-marker="last"]')).toBeNull();
    cleanup();
    render(SparklineLite, {
      props: { values: [1, 2], label: 'Given', description: 'Up all week.' },
    });
    expect(screen.getByRole('img', { name: 'Given' }).querySelector('desc')?.textContent).toBe(
      'Up all week.'
    );
  });

  it('draws bars as two paths whatever the series length, and long series stay bounded', () => {
    const values = Array.from({ length: 5_000 }, (_, i) => Math.sin(i / 50) * 10);
    const { container } = render(SparklineLite, {
      props: { values, label: 'Bars', variant: 'bar' },
    });
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('opacity')).toBe('0.58');
    expect(paths[1]?.getAttribute('d')).toMatch(/^M[^M]+Z$/);
    expect(container.querySelectorAll('rect')).toHaveLength(0);
    expect(
      barsPaths({
        points: [
          { index: 0, x: 25, y: 10, value: 2 },
          { index: 1, x: 75, y: null, value: null },
        ],
        line: '',
        area: '',
        last: 0,
        baseline: 20,
        barWidth: 10,
      })
    ).toEqual({ rest: '', last: 'M20,10h10v10h-10Z' });
  });
});

/*
 * What a sparkline adds to a first screen: a production Vite build of two
 * pages (one with the chart, one without) sharing chunks, measured as the gzip
 * of each page's entry chunk plus its static imports, the way a consumer app's
 * budget sees it. The light entry has to stay under 3,300 B and below the
 * full `@texuli/charts/compact` Sparkline.
 */
describe('SparklineLite first-screen cost (real Vite build)', () => {
  const LITE_CEILING = 3_300;

  it('adds less to a first screen than the compact Sparkline, and under 3,300 B gzip', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const dir = await mkdtemp(join(tmpdir(), 'texuli-sparkline-lite-'));
    const previousEnv = process.env.NODE_ENV;
    try {
      await mkdir(join(dir, 'src'));
      await mkdir(join(dir, 'node_modules/@texuli'), { recursive: true });
      await symlink(resolve(root, 'packages/charts'), join(dir, 'node_modules/@texuli/charts'));
      await symlink(resolve(root, 'node_modules/svelte'), join(dir, 'node_modules/svelte'));
      const page = (name: string, body: string, script = '') =>
        Promise.all([
          writeFile(
            join(dir, `${name}.html`),
            `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name}</title></head><body><div id="app"></div><script type="module" src="/src/${name}.ts"></script></body></html>`
          ),
          writeFile(
            join(dir, `src/${name}.ts`),
            `import { mount } from 'svelte';\nimport App from './${name}.svelte';\nmount(App, { target: document.getElementById('app') as HTMLElement });\n`
          ),
          writeFile(
            join(dir, `src/${name}.svelte`),
            `<script lang="ts">\n${script}\nlet open = $state(false);\n</script>\n<main><h1>Dashboard</h1>${body}<button type="button" onclick={() => (open = !open)}>Toggle</button>{#if open}<p>Details</p>{/if}</main>\n`
          ),
        ]);
      await page('baseline', '');
      await page(
        'full',
        '<Sparkline values={[3, 5, 4, 8, 7, 9]} label="Trend" period="6 days" />',
        "import { Sparkline } from '@texuli/charts/compact';"
      );
      await page(
        'lite',
        '<SparklineLite values={[3, 5, 4, 8, 7, 9]} label="Trend" period="6 days" />',
        "import { Sparkline as SparklineLite } from '@texuli/charts/sparkline-lite';"
      );
      const [{ build }, { svelte }] = await Promise.all([
        import('vite'),
        import('@sveltejs/vite-plugin-svelte'),
      ]);
      // Vitest runs with NODE_ENV=test, which would build Svelte's development output.
      process.env.NODE_ENV = 'production';
      const result = await build({
        configFile: false,
        logLevel: 'silent',
        mode: 'production',
        root: dir,
        plugins: [svelte({ configFile: false })],
        build: {
          write: false,
          rollupOptions: {
            input: {
              baseline: join(dir, 'baseline.html'),
              full: join(dir, 'full.html'),
              lite: join(dir, 'lite.html'),
            },
          },
        },
      });
      const chunks = (Array.isArray(result) ? result : [result])
        .flatMap((item) => ('output' in item ? item.output : []))
        .filter((file) => file.type === 'chunk');
      const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      const firstScreen = (name: string) => {
        const entry = chunks.find((chunk) => chunk.isEntry && chunk.name === name);
        if (!entry) throw new Error(`no entry ${name}`);
        const seen = new Set<string>();
        const queue = [entry.fileName];
        while (queue.length) {
          const file = queue.pop() as string;
          if (seen.has(file)) continue;
          seen.add(file);
          queue.push(...(byFile.get(file)?.imports ?? []));
        }
        return [...seen].reduce(
          (sum, file) => sum + gzipSync(byFile.get(file)?.code ?? '', { level: 9 }).length,
          0
        );
      };
      const baseline = firstScreen('baseline');
      const full = firstScreen('full') - baseline;
      const lite = firstScreen('lite') - baseline;
      console.info(`sparkline first-screen add: compact ${full} B, lite ${lite} B gzip`);
      expect(lite).toBeLessThan(full);
      expect(lite).toBeLessThanOrEqual(LITE_CEILING);
    } finally {
      process.env.NODE_ENV = previousEnv;
      await rm(dir, { recursive: true, force: true });
    }
  }, 240_000);
});

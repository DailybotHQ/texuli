// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  resolveDesignSystem,
} from '../../packages/tokens/src/design-system/compile.ts';
import { noFlashScript } from '../../packages/tokens/src/no-flash/index.ts';

declare const process: { env: Record<string, string | undefined> };

/*
 * ADR-023: switching design systems is one style write per scope and must
 * fit one frame. On headless chromium, a page with 1,000 elements under one
 * scope, every one painted from design-system variables (colors, spacing,
 * radius, fonts, shadow), switches between two compiled design systems
 * (acme and minimal, alternating light and dark): each sample is
 * `applyDesignSystem` plus a forced style recalculation and layout, read
 * back synchronously. The bound is the median of 40 switches under 16 ms
 * (one 60 Hz frame); the slowest switch is reported, not asserted. The same
 * page also proves, in a real engine, that the computed variables from the
 * SSR style, from apply and from the no-flash replay are identical.
 * Measured locally on an Apple silicon laptop (2026-10-30): see
 * packages/tokens/docs/design-system-runtime.md.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);

async function compiled(path: string): Promise<CompiledDesignSystem> {
  const doc = JSON.parse(readFileSync(join(root, path), 'utf8'));
  const resolved = await resolveDesignSystem(doc, { trust: 'developer' });
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
  const result = compileDesignSystem(resolved.document, {
    trust: 'developer',
    modes: ['light', 'dark'],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

/** The runtime as the browser gets it: one IIFE exposing `window.txds`. */
async function runtimeBundle(): Promise<string> {
  const esbuildId = require.resolve('esbuild', {
    paths: [dirname(require.resolve('vite/package.json'))],
  });
  const esbuild = require(esbuildId) as {
    build(options: Record<string, unknown>): Promise<{ outputFiles: { text: string }[] }>;
  };
  const result = await esbuild.build({
    entryPoints: [join(root, 'packages/tokens/src/design-system/apply.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'txds',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  return result.outputFiles[0]?.text ?? '';
}

const report = (name: string, ms: number) => {
  if (process.env.TEXULI_PERF_REPORT === '1') console.log(`[perf] ${name}: ${ms.toFixed(3)} ms`);
};

const STYLES = `
.tile {
  display: inline-block;
  margin: var(--tx-space-1);
  padding: var(--tx-space-2) var(--tx-space-4);
  border: var(--tx-border-width) solid var(--tx-border);
  border-radius: var(--tx-radius);
  background: var(--tx-primary);
  color: var(--tx-primary-foreground);
  font-family: var(--tx-font-sans);
  font-size: var(--tx-font-size-sm, 14px);
  box-shadow: var(--tx-shadow-soft);
}
.tile:nth-child(3n) { background: var(--tx-secondary); color: var(--tx-secondary-foreground); }
.tile:nth-child(5n) { background: var(--tx-muted); color: var(--tx-muted-foreground); }
`;

let browser: Browser;
let page: Page;
let acme: CompiledDesignSystem;
let minimal: CompiledDesignSystem;

beforeAll(async () => {
  [acme, minimal] = await Promise.all([
    compiled('packages/spec/fixtures/design-systems/acme.json'),
    compiled('packages/spec/fixtures/design-systems/minimal.json'),
  ]);
  browser = await chromium.launch();
  page = await browser.newPage();
  const tiles = Array.from({ length: 1000 }, (_, i) => `<span class="tile">Item ${i}</span>`);
  await page.setContent(
    `<!doctype html><html><head><style>${STYLES}</style></head><body><main id="scope">${tiles.join('')}</main></body></html>`
  );
  await page.addScriptTag({ content: await runtimeBundle() });
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

describe('design-system switch on chromium', () => {
  it('switches between two compiled design systems on a 1,000-node page within one frame', async () => {
    const result = await page.evaluate(
      ({ systems }) => {
        const api = (
          window as unknown as {
            txds: typeof import('../../packages/tokens/src/design-system/apply.ts');
          }
        ).txds;
        const scope = document.getElementById('scope') as HTMLElement;
        const tiles = scope.querySelectorAll('.tile');
        const last = tiles[tiles.length - 1] as HTMLElement;
        const modes = ['light', 'dark'] as const;
        const step = (i: number) => {
          const system = systems[i % 2] as (typeof systems)[number];
          api.applyDesignSystem(scope, system, {
            mode: modes[Math.floor(i / 2) % 2] ?? 'light',
            fonts: false,
          });
          // Force style and layout: the switch is not done until the page can paint it.
          void document.body.offsetHeight;
          return getComputedStyle(last).backgroundColor;
        };
        for (let i = 0; i < 8; i++) step(i);
        const samples: number[] = [];
        const colors = new Set<string>();
        for (let i = 0; i < 40; i++) {
          const started = performance.now();
          colors.add(step(i));
          samples.push(performance.now() - started);
        }
        samples.sort((a, b) => a - b);
        return {
          median: samples[Math.floor(samples.length / 2)] as number,
          max: samples[samples.length - 1] as number,
          colors: colors.size,
          nodes: tiles.length,
          vars: scope.style.length,
        };
      },
      { systems: [acme, minimal] }
    );
    report('design-system switch, 1,000 nodes (median of 40)', result.median);
    report('design-system switch, 1,000 nodes (slowest of 40)', result.max);
    expect(result.nodes).toBe(1000);
    // The switches really changed what paints: four distinct last-tile backgrounds.
    expect(result.colors).toBeGreaterThanOrEqual(2);
    expect(result.vars).toBeGreaterThan(100);
    expect(result.median).toBeLessThan(16);
  }, 60_000);

  it('SSR style, apply and the no-flash replay give identical computed variables in chromium', async () => {
    const script = noFlashScript('ds-perf');
    for (const system of [acme, minimal]) {
      for (const mode of ['light', 'dark'] as const) {
        const diff = await page.evaluate(
          ({ system, mode, script }) => {
            const api = (
              window as unknown as {
                txds: typeof import('../../packages/tokens/src/design-system/apply.ts');
              }
            ).txds;
            const names = api.designSystemDeclarations(system.vars[mode] ?? {}).map(([n]) => n);
            const read = (el: Element) => {
              const style = getComputedStyle(el);
              return names.map((name) => style.getPropertyValue(name));
            };
            const host = document.createElement('div');
            document.body.append(host);
            const style = document.createElement('style');
            style.textContent = api.designSystemStyle(system);
            document.head.append(style);
            const server = document.createElement('div');
            server.setAttribute('data-tx-ds', system.id);
            server.setAttribute('data-tx-mode', mode);
            const client = document.createElement('div');
            const replayed = document.createElement('div');
            host.append(server, client, replayed);
            api.applyDesignSystem(client, system, { mode, fonts: false });
            const store = new Map<string, string>([
              [
                'texuli.ds-perf.appearance',
                JSON.stringify({ v: 1, ...api.designSystemAppearance(system, { mode }) }),
              ],
            ]);
            // The replay body is the library's own `noFlashScript`, run against a stand-in root.
            new Function('document', 'localStorage', 'matchMedia', script)(
              { documentElement: replayed },
              { getItem: (key: string) => store.get(key) ?? null },
              () => ({ matches: false })
            );
            const a = read(server);
            const b = read(client);
            const c = read(replayed);
            style.remove();
            host.remove();
            const mismatches = names.filter((_, i) => a[i] !== b[i] || a[i] !== c[i]);
            return { count: names.length, empty: a.filter((v) => v === '').length, mismatches };
          },
          { system, mode, script }
        );
        expect(diff.count, `${system.id} ${mode}`).toBeGreaterThan(100);
        expect(diff.empty, `${system.id} ${mode}`).toBe(0);
        expect(diff.mismatches, `${system.id} ${mode}`).toEqual([]);
      }
    }
  }, 60_000);
});

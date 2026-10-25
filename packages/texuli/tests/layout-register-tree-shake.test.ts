// @vitest-environment node
/// <reference types="node" />
/**
 * Register-only layout subpaths must stay out of the initial consumer chunk.
 * Each layout file is its own dynamic import (separate chunks for mobile-tabs
 * vs mobile-drawer).
 */
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const texuliSrc = join(root, 'packages/texuli/src');
const require = createRequire(import.meta.url);

type EsbuildResult = {
  outputFiles?: { path: string; text: string }[];
};

type Esbuild = {
  build(options: Record<string, unknown>): Promise<EsbuildResult>;
};

function loadEsbuild(): Esbuild {
  const vitePkg = require.resolve('vite/package.json');
  const esbuildId = require.resolve('esbuild', { paths: [dirname(vitePkg)] });
  return require(esbuildId) as Esbuild;
}

async function bundleRegister(registerRel: string, exportName: string): Promise<string> {
  const esbuild = loadEsbuild();
  const entry = join(texuliSrc, registerRel);
  const result = await esbuild.build({
    stdin: {
      contents: `export { ${exportName} } from ${JSON.stringify(entry)};\n`,
      resolveDir: dirname(entry),
      sourcefile: 'register-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
    packages: 'bundle',
    external: [
      'svelte',
      'svelte/internal',
      'svelte/internal/client',
      '@texuli/core',
      '@texuli/primitives',
      '@texuli/tokens',
    ],
    plugins: [
      {
        name: 'external-svelte-layouts',
        setup(build: {
          onResolve(
            options: { filter: RegExp },
            callback: (args: { path: string }) => { path: string; external: boolean }
          ): void;
        }) {
          build.onResolve({ filter: /\.svelte$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
  });
  const file = result.outputFiles?.[0];
  if (!file) throw new Error(`no output for ${registerRel}`);
  return file.text;
}

describe('layout register-only subpaths (tree-shake)', () => {
  it('package.json exports register subpaths and keeps sideEffects CSS-only', () => {
    const pkg = require(join(root, 'packages/texuli/package.json')) as {
      sideEffects?: unknown;
      exports?: Record<string, unknown>;
    };
    expect(pkg.sideEffects).toEqual(['**/*.css']);
    expect(pkg.exports?.['./layouts/mobile/register']).toBeTruthy();
    expect(pkg.exports?.['./layouts/dashboard/register']).toBeTruthy();
    expect(pkg.exports?.['./layouts/marketing/register']).toBeTruthy();
  });

  it('mobile register entry has no layout component bodies; two separate dynamic imports', async () => {
    const entryCode = await bundleRegister('layouts/mobile/register.ts', 'registerMobileLayouts');
    expect(entryCode).toMatch(/registerMobileLayouts/);
    expect(entryCode).toMatch(/import\(\s*['"][^'"]*MobileTabsLayout\.svelte['"]\s*\)/);
    expect(entryCode).toMatch(/import\(\s*['"][^'"]*MobileDrawerLayout\.svelte['"]\s*\)/);
    for (const marker of [
      'data-tx-mobile-layout',
      'tx-mobile-tabs',
      'tx-mobile-drawer',
      'create_fragment',
    ]) {
      expect(entryCode.includes(marker), `entry leaked ${marker}`).toBe(false);
    }
    expect(entryCode.match(/import\(/g)?.length).toBe(2);
  });

  it('dashboard register entry has one dynamic import and no grid body', async () => {
    const entryCode = await bundleRegister(
      'layouts/dashboard/register.ts',
      'registerDashboardLayouts'
    );
    expect(entryCode).toMatch(/registerDashboardLayouts/);
    expect(entryCode).toMatch(/import\(\s*['"][^'"]*DashboardGridLayout\.svelte['"]\s*\)/);
    for (const marker of [
      'data-tx-layout-dashboard',
      'tx-layout-dashboard',
      'AnalyticsGrid',
      'create_fragment',
    ]) {
      expect(entryCode.includes(marker), `entry leaked ${marker}`).toBe(false);
    }
    expect(entryCode.match(/import\(/g)?.length).toBe(1);
  });

  it('marketing register entry has one dynamic import and no marketing body', async () => {
    const entryCode = await bundleRegister(
      'layouts/marketing/register.ts',
      'registerMarketingLayouts'
    );
    expect(entryCode).toMatch(/registerMarketingLayouts/);
    expect(entryCode).toMatch(/import\(\s*['"][^'"]*MarketingLayout\.svelte['"]\s*\)/);
    for (const marker of [
      'tx-layout-marketing',
      'LandingLayout',
      'PricingLayout',
      'create_fragment',
    ]) {
      expect(entryCode.includes(marker), `entry leaked ${marker}`).toBe(false);
    }
    expect(entryCode.match(/import\(/g)?.length).toBe(1);
  });
});

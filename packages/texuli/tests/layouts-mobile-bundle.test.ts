// @vitest-environment node
/**
 * `texuli/layouts/mobile` re-exports the standalone parts (`BottomNav`,
 * `MobileHeader`, `MobileAppFrame`) next to the framework-free model helpers.
 * An app that imports only the helpers must not ship the parts, their CSS or
 * the registered layouts: the entry is built the way `pnpm size` builds one
 * (Vite, minified, `svelte` external) and its modules are read from the output.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MOBILE = resolve(dirname(fileURLToPath(import.meta.url)), '../src/layouts/mobile/index.ts');

async function buildEntry(source: string) {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  const dir = await mkdtemp(join(tmpdir(), 'texuli-mobile-graph-'));
  try {
    const main = join(dir, 'entry.js');
    await writeFile(main, source);
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode: 'production',
      root: dir,
      plugins: [svelte({ configFile: false })],
      build: {
        write: false,
        minify: true,
        target: 'es2022',
        cssCodeSplit: true,
        reportCompressedSize: false,
        lib: { entry: main, formats: ['es'], fileName: 'entry' },
        rollupOptions: { external: (id: string) => id === 'svelte' || id.startsWith('svelte/') },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
      'output' in item ? item.output : []
    );
    return {
      modules: outputs.flatMap((file) =>
        file.type === 'chunk' ? Object.keys(file.modules).map((id) => id.replaceAll('\\', '/')) : []
      ),
      css: outputs.filter((file) => file.type === 'asset' && file.fileName.endsWith('.css')),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const PARTS = [
  'BottomNav.svelte',
  'MobileHeader.svelte',
  'MobileAppFrame.svelte',
  'MobileTabsLayout.svelte',
  'MobileDrawerLayout.svelte',
];

describe('texuli/layouts/mobile tree-shaking', () => {
  it('drops the standalone parts and their CSS when only the model helpers are imported', async () => {
    const { modules, css } = await buildEntry(
      `export { splitTabs, stackHeader, navCurrent, bottomNavCurrent, topLevelItems, MOBILE_TAB_LIMIT, currentHashPath } from ${JSON.stringify(MOBILE)};\n`
    );
    expect(modules.some((id) => id.endsWith('/layouts/mobile/model.ts'))).toBe(true);
    expect(
      PARTS.filter((part) => modules.some((id) => id.endsWith(`/layouts/mobile/${part}`)))
    ).toEqual([]);
    expect(css).toEqual([]);
  }, 180_000);

  it('keeps a part (and its CSS) when it is imported', async () => {
    const { modules, css } = await buildEntry(
      `export { BottomNav, splitTabs } from ${JSON.stringify(MOBILE)};\n`
    );
    expect(modules.some((id) => id.endsWith('/layouts/mobile/BottomNav.svelte'))).toBe(true);
    expect(modules.some((id) => id.endsWith('/layouts/mobile/MobileHeader.svelte'))).toBe(false);
    expect(css.length).toBeGreaterThan(0);
  }, 180_000);
});

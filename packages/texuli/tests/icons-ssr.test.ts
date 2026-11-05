/// <reference types="node" />
/**
 * A lazy icon on the server (D-G-039): the server HTML holds the fallback
 * glyph (nothing loads there), and the client hydrates that same element
 * without a mismatch before the loaded glyph replaces it. The server bundle
 * is built the way a Vite host builds it and rendered in a separate Node
 * process with `svelte/server`, as the Select SSR test does.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitFor } from '@testing-library/svelte';
import { hydrate, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { iconPath } from '../src/components/icons/icons.ts';
import Host from './fixtures/IconsLazyHost.svelte';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = resolve(HERE, 'fixtures/IconsLazyHost.svelte');
const SCRATCH = resolve(HERE, '../../../tmp');

async function serverRender(): Promise<string> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'icons-ssr-'));
  try {
    const main = join(dir, 'entry.js');
    await writeFile(
      main,
      [
        "import { render } from 'svelte/server';",
        `import Host from ${JSON.stringify(HOST)};`,
        'const { body } = render(Host, { props: {} });',
        'process.stdout.write(body);',
        '',
      ].join('\n')
    );
    await build({
      configFile: false,
      logLevel: 'silent',
      mode: 'production',
      root: dir,
      plugins: [svelte({ configFile: false })],
      build: {
        ssr: main,
        outDir: join(dir, 'out'),
        minify: false,
        target: 'node22',
        reportCompressedSize: false,
        rollupOptions: {
          external: (id: string) => id === 'svelte' || id.startsWith('svelte/'),
          output: { format: 'es', entryFileNames: 'entry.mjs' },
        },
      },
    });
    return execFileSync(process.execPath, [join(dir, 'out/entry.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('lazy icons on the server', () => {
  it('render the fallback, then hydrate it and swap in the loaded glyph', async () => {
    const html = await serverRender();
    const fallback = iconPath('info');
    expect(html).toContain(`d="${fallback}"`);
    expect(html).toContain('aria-label="Rocket"');

    const target = document.createElement('div');
    target.innerHTML = html;
    document.body.append(target);
    const serverSvg = target.querySelector('svg');
    const warn = vi.spyOn(console, 'warn');
    const app = hydrate(Host, { target });
    try {
      // Hydration adopts the server element: same node, no mismatch warning.
      expect(target.querySelector('svg')).toBe(serverSvg);
      expect(warn.mock.calls.flat().join(' ')).not.toMatch(/hydration/i);
      await waitFor(() =>
        expect(target.querySelector('svg path')?.getAttribute('d')).toMatch(/^M12 3 14\.8/)
      );
      expect(target.querySelector('svg')?.getAttribute('aria-label')).toBe('Rocket');
    } finally {
      warn.mockRestore();
      unmount(app);
      target.remove();
    }
  }, 180_000);
});

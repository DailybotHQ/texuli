// @vitest-environment node
/**
 * The Dashboard on the server: widgets register while the dashboard renders,
 * so server HTML already holds every widget in reading order (no-JS readers
 * and crawlers). Built the way a Vite host builds its server bundle and
 * rendered in a separate Node process with `svelte/server`, as the slides
 * SSR test does.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');
const SCRATCH = resolve(HERE, '../../../tmp');

const HOST = `<script lang="ts">
import { Dashboard, DashboardWidget } from ${JSON.stringify(`${SRC}/dashboard/index.ts`)};
</script>
<Dashboard label="Server dashboard" editable>
  <DashboardWidget id="bravo" title="Bravo" x={6} y={0} w={6} h={2}><p>Bravo body</p></DashboardWidget>
  <DashboardWidget id="alpha" title="Alpha" x={0} y={0} w={6} h={2}><p>Alpha body</p></DashboardWidget>
  <DashboardWidget id="charlie" title="Charlie" x={0} y={2} w={12} h={2}><p>Charlie body</p></DashboardWidget>
</Dashboard>
`;

async function serverRender(host: string): Promise<string> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'dashboard-ssr-'));
  try {
    await writeFile(join(dir, 'Host.svelte'), host);
    const main = join(dir, 'entry.js');
    await writeFile(
      main,
      [
        "import { render } from 'svelte/server';",
        "import Host from './Host.svelte';",
        'const { head, body } = render(Host, { props: {} });',
        'process.stdout.write(head + body);',
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
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('Dashboard on the server', () => {
  it('renders every widget, in reading order, with titles and handles', async () => {
    const html = await serverRender(HOST);
    const alpha = html.indexOf('Alpha body');
    const bravo = html.indexOf('Bravo body');
    const charlie = html.indexOf('Charlie body');
    expect(alpha).toBeGreaterThan(-1);
    expect(alpha).toBeLessThan(bravo);
    expect(bravo).toBeLessThan(charlie);
    expect(html).toContain('aria-label="Server dashboard"');
    expect(html).toContain('aria-label="Move Alpha"');
    expect(html).toContain('data-breakpoint="lg"');
  }, 180_000);
});

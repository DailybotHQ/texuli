// @vitest-environment node
/**
 * Select on the server: `Select.Value` renders its label (or placeholder)
 * with and without a `children` snippet. Built the way a Vite host builds
 * its server bundle and rendered in a separate Node process with
 * `svelte/server`, as the dashboard and slides SSR tests do.
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
import { Select } from ${JSON.stringify(`${SRC}/components/select/index.ts`)};
const items = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
];
</script>
<span id="plain-label">Plain</span>
<Select.Root name="plain" {items}>
  <Select.Trigger aria-labelledby="plain-label">
    <Select.Value placeholder="Choose a plan" />
  </Select.Trigger>
</Select.Root>
<span id="chosen-label">Chosen</span>
<Select.Root name="chosen" value="team" {items}>
  <Select.Trigger aria-labelledby="chosen-label">
    <Select.Value placeholder="Choose a plan">
      {#snippet children({ label })}<em>Plan: {label}</em>{/snippet}
    </Select.Value>
  </Select.Trigger>
</Select.Root>
`;

async function serverRender(host: string): Promise<string> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'select-ssr-'));
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
      timeout: 60_000,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('Select on the server', () => {
  it('renders Select.Value with and without a children snippet', async () => {
    const html = await serverRender(HOST);
    expect(html).toContain('Choose a plan');
    expect(html).toContain('<em>Plan: Team</em>');
    expect(html.match(/data-tx-select-value/g)?.length).toBe(2);
  }, 180_000);
});

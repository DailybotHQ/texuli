// @vitest-environment node
/**
 * SchemaForm on the server: a form with a select field renders to HTML
 * (the select's `Select.Value` once recursed without children). Built the
 * way a Vite host builds its server bundle and rendered in a separate Node
 * process with `svelte/server`, as the dashboard and slides SSR tests do.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');
const SCRATCH = resolve(HERE, '../../../tmp');

const SCHEMA = {
  title: 'Plan request',
  fields: [
    { name: 'title', type: 'text', label: 'Job title', required: true },
    {
      name: 'plan',
      type: 'select',
      label: 'Plan',
      options: [
        { value: 'free', label: 'Free' },
        { value: 'team', label: 'Team' },
      ],
    },
  ],
};

const HOST = `<script lang="ts">
import { SchemaForm } from ${JSON.stringify(`${SRC}/index.ts`)};
import { validateFormSchema } from ${JSON.stringify(`${SRC}/model/index.ts`)};
const result = validateFormSchema(${JSON.stringify(SCHEMA)});
if (!result.ok) throw new Error('invalid schema');
</script>
<SchemaForm form={result.form} id="plan-request" />
`;

async function serverRender(host: string): Promise<string> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'forms-ssr-'));
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

describe('SchemaForm on the server', () => {
  it('renders a form with a select field, with field ids apart from the form ids', async () => {
    const html = await serverRender(HOST);
    expect(html).toContain('id="plan-request-title"');
    expect(html).toContain('id="plan-request-field-title"');
    expect(html).toContain('data-tx-select-value');
    expect(html).toContain('Choose an option');
  }, 180_000);

  it('renders lazy controls as placeholders by default and as controls with the static registry (G119)', async () => {
    const schema = {
      title: 'Booking',
      fields: [
        { name: 'day', type: 'date', label: 'Day' },
        { name: 'level', type: 'slider', label: 'Level', min: 0, max: 5 },
      ],
    };
    const host = (registry: boolean) => `<script lang="ts">
import { SchemaForm } from ${JSON.stringify(`${SRC}/index.ts`)};
import { validateFormSchema } from ${JSON.stringify(`${SRC}/model/index.ts`)};
${registry ? `import { SCHEMA_FORM_CONTROLS } from ${JSON.stringify(`${SRC}/view/controls/index.ts`)};` : ''}
const result = validateFormSchema(${JSON.stringify(schema)});
if (!result.ok) throw new Error('invalid schema');
</script>
<SchemaForm form={result.form} id="booking"${registry ? ' controls={SCHEMA_FORM_CONTROLS}' : ''} />
`;
    const lazy = await serverRender(host(false));
    expect(lazy).toContain('tx-forms__control-loading');
    expect(lazy).toContain('Day');
    const eager = await serverRender(host(true));
    expect(eager).not.toContain('tx-forms__control-loading');
    expect(eager).toContain('role="slider"');
    expect(eager).toContain('id="booking-field-day"');
  }, 240_000);
});

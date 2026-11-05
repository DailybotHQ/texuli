// @vitest-environment node
/// <reference types="node" />
/**
 * CodeField on the server (D-G-022): the first HTML already holds the
 * highlighted value (tokens as elements, never markup), the textarea with the
 * same text, and the keyboard hint. Built the way a Vite host builds its
 * server bundle and rendered in a separate Node process with `svelte/server`,
 * as the Select, dashboard and slides SSR tests do. Hydration and the caret
 * are checked in the browser (tests/e2e/code-field.spec.ts).
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(HERE, '../src/code/code-field-entry.ts');
const SCRATCH = resolve(HERE, '../../../tmp');

const HOST = `<script lang="ts">
import { CodeField } from ${JSON.stringify(ENTRY)};
let value = $state('const a = "<b>x</b>";\\n// note');
</script>
<CodeField bind:value language="ts" label="Snippet" lineNumbers name="snippet" />
`;

async function serverRender(host: string): Promise<string> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'code-field-ssr-'));
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

describe('CodeField on the server', () => {
  it('renders the highlighted value, the textarea and the hint', async () => {
    const html = await serverRender(HOST);
    expect(html).toContain('<span class="tx-code-tok--keyword">const</span>');
    expect(html).toContain('<span class="tx-code-tok--string">"&lt;b>x&lt;/b>"</span>');
    expect(html).toContain('<span class="tx-code-tok--comment">// note</span>');
    expect(html).not.toContain('<b>');
    expect(html).toMatch(/<pre class="tx-code-field__pre" aria-hidden="true">/);
    expect(html).toMatch(
      /<textarea[^>]*name="snippet"[^>]*>const a = "&lt;b>x&lt;\/b>";\n\/\/ note<\/textarea>/
    );
    expect(html).toContain('data-highlight="on"');
    expect(html.match(/class="tx-code-field__number"/g)).toHaveLength(2);
    expect(html).toContain('To leave the field, press Escape, then Tab.');
    // Nothing in the first HTML needs an inline style (strict CSP).
    expect(html).not.toMatch(/\sstyle="/);
  }, 180_000);
});

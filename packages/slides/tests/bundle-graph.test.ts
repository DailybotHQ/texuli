// @vitest-environment node
/**
 * The bundle a host gets (G24, G25): a host that turns the default renderer
 * tables off (`defaultRenderers={false}`) must not have the layouts table, the
 * component registry or its catalog outline in its initial graph, nor in the
 * print view's chunks; with the defaults on, they live in their own lazy
 * chunk. Each host is built the way `pnpm size` builds an entry (Vite,
 * minified, `svelte` external), and the chunk graph is read from the output.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/** Module ids that only the default tables bring in. */
const DEFAULT_ONLY = [
  '/slides/src/stage/default-renderers.ts',
  '/slides/src/layouts/index.ts',
  '/slides/src/registry/index.ts',
  '/slides/src/registry/catalog-ids.ts',
];

interface Chunk {
  fileName: string;
  isEntry: boolean;
  imports: readonly string[];
  dynamicImports: readonly string[];
  modules: readonly string[];
}

async function buildHost(source: string): Promise<Map<string, Chunk>> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  const dir = await mkdtemp(join(tmpdir(), 'texuli-slides-graph-'));
  try {
    await writeFile(join(dir, 'Host.svelte'), source);
    const main = join(dir, 'entry.js');
    await writeFile(main, "export { default } from './Host.svelte';\n");
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
        reportCompressedSize: false,
        lib: { entry: main, formats: ['es'], fileName: 'entry' },
        rollupOptions: { external: (id: string) => id === 'svelte' || id.startsWith('svelte/') },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
      'output' in item ? item.output : []
    );
    const chunks = new Map<string, Chunk>();
    for (const file of outputs) {
      if (file.type !== 'chunk') continue;
      chunks.set(file.fileName, {
        fileName: file.fileName,
        isEntry: file.isEntry,
        imports: file.imports,
        dynamicImports: file.dynamicImports,
        modules: Object.keys(file.modules).map((id) => id.replaceAll('\\', '/')),
      });
    }
    return chunks;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The modules of `roots` and every chunk they import statically. */
function staticModules(chunks: Map<string, Chunk>, roots: readonly string[]): string[] {
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (seen.has(name) || !chunks.has(name)) return;
    seen.add(name);
    for (const imported of chunks.get(name)?.imports ?? []) visit(imported);
  };
  for (const root of roots) visit(root);
  return [...seen].flatMap((name) => chunks.get(name)?.modules ?? []);
}

function chunkWith(chunks: Map<string, Chunk>, suffix: string): Chunk | undefined {
  return [...chunks.values()].find((chunk) => chunk.modules.some((id) => id.endsWith(suffix)));
}

const defaultsIn = (modules: readonly string[]) =>
  DEFAULT_ONLY.filter((suffix) => modules.some((id) => id.endsWith(suffix)));

describe('the slides bundle graph', () => {
  it('keeps the default renderer tables out of a stage host that turns them off', async () => {
    const chunks = await buildHost(`<script lang="ts">
import { DeckStage } from ${JSON.stringify(`${SRC}/stage/index.ts`)};
let { deck }: { deck: unknown } = $props();
</script>
<DeckStage {deck} defaultRenderers={false} />
`);
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry).map((c) => c.fileName);
    const initial = staticModules(chunks, entries);
    expect(initial.some((id) => id.endsWith('/slides/src/stage/DeckStage.svelte'))).toBe(true);
    expect(defaultsIn(initial)).toEqual([]);
    // The defaults are still there for hosts that keep them on, as a lazy chunk.
    const lazy = chunkWith(chunks, '/slides/src/stage/default-renderers.ts');
    expect(lazy, 'the default tables chunk').toBeTruthy();
    expect(entries).not.toContain(lazy?.fileName);
  }, 180_000);

  it('keeps them out of the print view when it turns them off', async () => {
    const chunks = await buildHost(`<script lang="ts">
import { DeckPrintView } from ${JSON.stringify(`${SRC}/export/index.ts`)};
let { deck }: { deck: never } = $props();
</script>
<DeckPrintView {deck} defaultRenderers={false} />
`);
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry).map((c) => c.fileName);
    expect(defaultsIn(staticModules(chunks, entries))).toEqual([]);
    // The print body and its painter load later, without the default tables.
    for (const suffix of ['/export/DeckPrintPages.svelte', '/export/print-paint.ts']) {
      const chunk = chunkWith(chunks, suffix);
      expect(chunk, suffix).toBeTruthy();
      expect(defaultsIn(staticModules(chunks, [chunk?.fileName ?? ''])), suffix).toEqual([]);
    }
    expect(chunkWith(chunks, '/slides/src/stage/default-renderers.ts')).toBeTruthy();
  }, 180_000);
});

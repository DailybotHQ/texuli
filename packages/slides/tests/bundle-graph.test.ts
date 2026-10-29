// @vitest-environment node
/**
 * The bundle a host gets (G24, G25): a host that turns the default renderer
 * tables off (`defaultRenderers={false}`) must not have the layouts table, the
 * component registry or its catalog outline in its initial graph, nor in the
 * print view's chunks; with the defaults on, they live in their own lazy
 * chunk. A host that also brings its own block check, free-slide renderer
 * and theme loader (G46, G47) has no `@texuli/blocks`, no `migrateDeck`
 * (for a v2 deck), no theme library records and no theme generator in its
 * initial graph. Each host is built the way `pnpm size` builds an entry
 * (Vite, minified, `svelte` external), and the chunk graph is read from the
 * output.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/** Module ids that only the default tables bring in. */
const DEFAULT_ONLY = [
  '/slides/src/stage/default-renderers.ts',
  '/slides/src/layouts/index.ts',
  '/slides/src/registry/index.ts',
  '/slides/src/registry/catalog-ids.ts',
];

/** Module id fragments a host with its own block check, free renderer and theme loader never loads. */
const HOST_REPLACED = [
  '/blocks/src/',
  '/deck/src/model/migrate.ts',
  '/tokens/src/library-port/',
  '/tokens/src/library-expand/',
  '/tokens/src/generator/',
  '/slides/src/stage/block-check.ts',
  '/slides/src/stage/FreeSlide.svelte',
  '/slides/src/stage/loaders.ts',
];

interface Chunk {
  fileName: string;
  code: string;
  isEntry: boolean;
  imports: readonly string[];
  dynamicImports: readonly string[];
  modules: readonly string[];
}

async function buildHost(
  source: string,
  extra: Readonly<Record<string, string>> = {}
): Promise<Map<string, Chunk>> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  const dir = await mkdtemp(join(tmpdir(), 'texuli-slides-graph-'));
  try {
    await writeFile(join(dir, 'Host.svelte'), source);
    for (const [name, text] of Object.entries(extra)) await writeFile(join(dir, name), text);
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
        code: file.code,
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

/** `roots` and every chunk they import statically. */
function staticChunks(chunks: Map<string, Chunk>, roots: readonly string[]): Chunk[] {
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (seen.has(name) || !chunks.has(name)) return;
    seen.add(name);
    for (const imported of chunks.get(name)?.imports ?? []) visit(imported);
  };
  for (const root of roots) visit(root);
  return [...seen].flatMap((name) => chunks.get(name) ?? []);
}

/** The modules of `roots` and every chunk they import statically. */
function staticModules(chunks: Map<string, Chunk>, roots: readonly string[]): string[] {
  return staticChunks(chunks, roots).flatMap((chunk) => chunk.modules);
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

  it('keeps the server preload out of a browser build with the defaults on', async () => {
    const chunks = await buildHost(`<script lang="ts">
import { DeckStage } from ${JSON.stringify(`${SRC}/stage/index.ts`)};
let { deck }: { deck: unknown } = $props();
</script>
<DeckStage {deck} />
`);
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry).map((c) => c.fileName);
    // The browser takes the empty `#deck-ssr` (`ssr-browser.ts`): no chunk preloads anything.
    const every = [...chunks.values()].flatMap((chunk) => chunk.modules);
    expect(every.filter((id) => /\/stage\/ssr-(preload|server)\.ts$/.test(id))).toEqual([]);
    expect(defaultsIn(staticModules(chunks, entries))).toEqual([]);
    expect(chunkWith(chunks, '/slides/src/stage/default-renderers.ts')).toBeTruthy();
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

  it('keeps the default block check, free renderer, migration and theme library out of a host that replaces them', async () => {
    const chunks = await buildHost(
      `<script lang="ts">
import { DeckStage } from ${JSON.stringify(`${SRC}/stage/index.ts`)};
import HostFree from './HostFree.svelte';
let { deck }: { deck: unknown } = $props();
const renderers = { validateBlock: () => undefined, free: () => HostFree };
const loadTheme = async (id: string) => ({ id }) as never;
</script>
<DeckStage {deck} defaultRenderers={false} {renderers} {loadTheme} />
`,
      { 'HostFree.svelte': '<p>host</p>\n' }
    );
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry).map((c) => c.fileName);
    const initial = staticChunks(chunks, entries);
    const modules = initial.flatMap((chunk) => chunk.modules);
    expect(modules.some((id) => id.endsWith('/slides/src/stage/DeckStage.svelte'))).toBe(true);
    expect(HOST_REPLACED.filter((part) => modules.some((id) => id.includes(part)))).toEqual([]);
    expect(defaultsIn(modules)).toEqual([]);
    // The fallbacks are still there, as lazy chunks, for stages that need them.
    for (const suffix of ['/slides/src/stage/builtin.ts', '/deck/src/model/migrate.ts']) {
      const lazy = chunkWith(chunks, suffix);
      expect(lazy, suffix).toBeTruthy();
      expect(initial).not.toContain(lazy);
    }
    const gzip = initial.reduce((sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length, 0);
    // Reported, not asserted (the size budgets own the numbers).
    console.info(
      `[bundle-graph] replacing host: initial JS ${gzip} B gzip in ${initial.length} chunks`
    );
  }, 180_000);
});

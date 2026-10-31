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

/**
 * The token theme library (G127): only the default entries' `loadTheme` reaches it. A host on
 * the core entries injects its own loader (or none), so no chunk of its build, initial or lazy,
 * carries the library records or the 146 expand definition modules.
 */
const THEME_LIBRARY = ['/tokens/src/library-expand/', '/tokens/src/library-port/'];

const libraryIn = (modules: readonly string[]) =>
  THEME_LIBRARY.filter((part) => modules.some((id) => id.includes(part)));

/** Module id fragments only a deck with a `designSystem` loads (ADR-024): never in the initial graph. */
const DESIGN_SYSTEM_ONLY = [
  '/slides/src/stage/design-system.ts',
  '/player/src/design-system.ts',
  '/tokens/src/design-system/apply.ts',
  '/tokens/src/design-system/compile',
  '/texuli/src/defaults/',
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

/**
 * The modules of `roots` and every chunk they import, statically or with
 * `import()`, never entering the `skip` chunk.
 */
function loadableModules(
  chunks: Map<string, Chunk>,
  roots: readonly string[],
  skip?: string
): string[] {
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (name === skip || seen.has(name) || !chunks.has(name)) return;
    seen.add(name);
    const chunk = chunks.get(name);
    for (const next of [...(chunk?.imports ?? []), ...(chunk?.dynamicImports ?? [])]) visit(next);
  };
  for (const root of roots) visit(root);
  return [...seen].flatMap((name) => chunks.get(name)?.modules ?? []);
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
    // A deck without a design system costs nothing: the step is a lazy chunk.
    expect(DESIGN_SYSTEM_ONLY.filter((part) => initial.some((id) => id.includes(part)))).toEqual(
      []
    );
    const step = chunkWith(chunks, '/slides/src/stage/design-system.ts');
    expect(step, 'the design-system step chunk').toBeTruthy();
    expect(entries).not.toContain(step?.fileName);
    // The defaults are still there for hosts that keep them on, as a lazy chunk.
    const lazy = chunkWith(chunks, '/slides/src/stage/default-renderers.ts');
    expect(lazy, 'the default tables chunk').toBeTruthy();
    expect(entries).not.toContain(lazy?.fileName);
  }, 180_000);

  it('emits no default-table chunk at all for a host on the stage core (G72)', async () => {
    const chunks = await buildHost(
      `<script lang="ts">
import { DeckStageCore } from ${JSON.stringify(`${SRC}/stage/core.ts`)};
import HostFree from './HostFree.svelte';
let { deck }: { deck: unknown } = $props();
const renderers = { validateBlock: () => undefined, free: () => HostFree };
</script>
<DeckStageCore {deck} {renderers} loadTheme={null} />
`,
      { 'HostFree.svelte': '<p>host</p>\n' }
    );
    const every = [...chunks.values()].flatMap((chunk) => chunk.modules);
    expect(every.some((id) => id.endsWith('/slides/src/stage/DeckStageCore.svelte'))).toBe(true);
    // Not in the initial graph, and not as a lazy chunk either: nothing references them.
    expect(defaultsIn(every)).toEqual([]);
    expect(every.filter((id) => id.endsWith('/slides/src/stage/defaults.ts'))).toEqual([]);
    expect(chunkWith(chunks, '/slides/src/stage/default-renderers.ts')).toBeUndefined();
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry).map((c) => c.fileName);
    const initial = staticChunks(chunks, entries);
    const gzip = initial.reduce((sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length, 0);
    const all = [...chunks.values()].reduce(
      (sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length,
      0
    );
    // Reported, not asserted (the size budgets own the numbers).
    console.info(
      `[bundle-graph] stage-core host: initial JS ${gzip} B gzip, every chunk ${all} B gzip in ${chunks.size} chunks`
    );
  }, 180_000);

  it('emits no default-table chunk at all for a stage-core host that prints through the export core (G105)', async () => {
    const chunks = await buildHost(
      `<script lang="ts">
import { DeckStageCore } from ${JSON.stringify(`${SRC}/stage/core.ts`)};
import HostFree from './HostFree.svelte';
let { deck }: { deck: unknown } = $props();
const renderers = { validateBlock: () => undefined, free: () => HostFree };
void import(${JSON.stringify(`${SRC}/export/core.ts`)}).then((m) => m.preloadDeckPrintViewCore());
</script>
<DeckStageCore {deck} {renderers} loadTheme={null} />
`,
      { 'HostFree.svelte': '<p>host</p>\n' }
    );
    const every = [...chunks.values()].flatMap((chunk) => chunk.modules);
    // The print core and its lazy body and painter are in the build...
    for (const suffix of [
      '/slides/src/export/core.ts',
      '/export/DeckPrintPages.svelte',
      '/export/print-paint.ts',
    ])
      expect(chunkWith(chunks, suffix), suffix).toBeTruthy();
    // ...and nothing references the default tables: no chunk, initial or lazy.
    expect(defaultsIn(every)).toEqual([]);
    expect(every.filter((id) => id.endsWith('/slides/src/stage/defaults.ts'))).toEqual([]);
    expect(every.filter((id) => id.endsWith('/slides/src/export/print-preload.ts'))).toEqual([]);
    expect(chunkWith(chunks, '/slides/src/stage/default-renderers.ts')).toBeUndefined();
    const all = [...chunks.values()].reduce(
      (sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length,
      0
    );
    // Reported, not asserted (the size budgets own the numbers).
    console.info(
      `[bundle-graph] stage-core + export-core host: every chunk ${all} B gzip in ${chunks.size} chunks`
    );
  }, 180_000);

  it('keeps @texuli/slides/export printing with the default tables, as a lazy chunk (G105)', async () => {
    const chunks = await buildHost(`<script lang="ts">
import { DeckPrintView } from ${JSON.stringify(`${SRC}/export/index.ts`)};
let { deck }: { deck: never } = $props();
</script>
<DeckPrintView {deck} />
`);
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry).map((c) => c.fileName);
    expect(defaultsIn(staticModules(chunks, entries))).toEqual([]);
    const lazy = chunkWith(chunks, '/slides/src/stage/default-renderers.ts');
    expect(lazy, 'the default tables chunk').toBeTruthy();
    expect(entries).not.toContain(lazy?.fileName);
    // G127: DeckPrintView keeps the library theme loader, as a lazy chunk.
    expect(chunkWith(chunks, '/tokens/src/library-expand/index.ts')).toBeTruthy();
    expect(libraryIn(staticModules(chunks, entries))).toEqual([]);
  }, 180_000);

  it('a host handing the stage core a prepared deck (G83) has no migration or block schema in its initial graph', async () => {
    const chunks = await buildHost(
      `<script lang="ts">
import { DeckStageCore, prepareDeckV2 } from ${JSON.stringify(`${SRC}/stage/core.ts`)};
import HostFree from './HostFree.svelte';
let { input }: { input: unknown } = $props();
const validateBlock = () => undefined;
const deck = $derived(prepareDeckV2(input, { validateBlock }));
const renderers = { free: () => HostFree };
</script>
<DeckStageCore {deck} tier="developer" {renderers} loadTheme={null} />
`,
      { 'HostFree.svelte': '<p>host</p>\n' }
    );
    const entries = [...chunks.values()].filter((chunk) => chunk.isEntry).map((c) => c.fileName);
    const modules = staticModules(chunks, entries);
    expect(modules.some((id) => id.endsWith('/slides/src/stage/prepare-core.ts'))).toBe(true);
    expect(HOST_REPLACED.filter((part) => modules.some((id) => id.includes(part)))).toEqual([]);
    expect(defaultsIn(modules)).toEqual([]);
    // The stage still ships its fallbacks as lazy chunks; a prepared deck never asks for them
    // (tests/stage-prepared.test.ts proves the first paint loads neither).
    for (const suffix of ['/slides/src/stage/builtin.ts', '/deck/src/model/migrate.ts']) {
      const lazy = chunkWith(chunks, suffix);
      expect(lazy, suffix).toBeTruthy();
      expect(entries).not.toContain(lazy?.fileName);
    }
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
    // G127: DeckStage keeps the library theme loader, as a lazy chunk.
    const library = chunkWith(chunks, '/tokens/src/library-expand/index.ts');
    expect(library, 'the theme library chunk').toBeTruthy();
    expect(libraryIn(staticModules(chunks, entries))).toEqual([]);
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

  it('a stage-core and export-core host reaches the theme library only through a loader it injects (G127)', async () => {
    const hosts = {
      // The host hands the stage and the print view an already resolved theme.
      resolved: `const theme = { id: 'host' } as never;
const loadTheme = async () => theme;`,
      // The host leaves catalog themes to its CSS (no loader at all).
      none: 'const loadTheme = undefined;',
      // Control: a core host that opts into the library by name does reach it.
      library: `import { loadDeckLibraryTheme as loadTheme } from ${JSON.stringify(`${SRC}/stage/core.ts`)};`,
    };
    for (const [name, loader] of Object.entries(hosts)) {
      const chunks = await buildHost(
        `<script lang="ts">
import { DeckStageCore } from ${JSON.stringify(`${SRC}/stage/core.ts`)};
import { DeckPrintViewCore } from ${JSON.stringify(`${SRC}/export/core.ts`)};
import HostFree from './HostFree.svelte';
${loader}
let { deck }: { deck: never } = $props();
const renderers = { validateBlock: () => undefined, free: () => HostFree };
</script>
<DeckStageCore {deck} {renderers} {loadTheme} />
<DeckPrintViewCore {deck} {renderers} {loadTheme} />
`,
        { 'HostFree.svelte': '<p>host</p>\n' }
      );
      const every = [...chunks.values()].flatMap((chunk) => chunk.modules);
      expect(
        every.some((id) => id.endsWith('/slides/src/stage/DeckStageCore.svelte')),
        name
      ).toBe(true);
      expect(chunkWith(chunks, '/export/print-paint.ts'), name).toBeTruthy();
      const entries = [...chunks.values()].filter((chunk) => chunk.isEntry).map((c) => c.fileName);
      // Every chunk the host can load, initial or lazy, except through a deck's design-system
      // step (ADR-024: `designSystem.ref: "texuli:<id>"` falls back to the library in
      // @texuli/player/design-system; only a deck that names a design system loads that step).
      const step = chunkWith(chunks, '/slides/src/stage/design-system.ts')?.fileName;
      const reachable = loadableModules(chunks, entries, step);
      expect(libraryIn(reachable), name).toEqual(name === 'library' ? THEME_LIBRARY : []);
      expect(libraryIn(staticModules(chunks, entries)), name).toEqual([]);
      const library = [...chunks.values()].filter((chunk) => libraryIn(chunk.modules).length > 0);
      // Reported, not asserted (the size budgets own the numbers).
      console.info(
        `[bundle-graph] core host (${name} loader): ${chunks.size} chunks, ${library.length} with theme library modules, none loadable outside the design-system step: ${libraryIn(reachable).length === 0}`
      );
    }
  }, 360_000);
});

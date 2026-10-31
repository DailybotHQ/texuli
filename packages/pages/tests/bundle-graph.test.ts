// @vitest-environment node
/**
 * The bundle a host gets (G123): `@texuli/pages` paints live embeds with
 * `@texuli/player`, loaded on first use. The default entries keep that
 * dynamic import, so a bundler that inlines lazy chunks (a single-file
 * export) carries the whole player even when no embed ever paints. A host on
 * the core entries (`editor-core`, `reader-core`, `paged-core`,
 * `collab-core`, `host-core`) with no `loadPlayer` has no `@texuli/player`
 * reference anywhere in its graph, static or dynamic: no player module in
 * any chunk, and no import specifier left in the code. Each host is built
 * the way `pnpm size` builds an entry (Vite, minified, `svelte` external),
 * and the chunk graph is read from the output.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const at = (path: string) => JSON.stringify(`${SRC}/${path}`);
/** `@texuli/player` as this package resolves it (the host is built from a temporary folder). */
const PLAYER = JSON.stringify(createRequire(import.meta.url).resolve('@texuli/player'));

interface Chunk {
  fileName: string;
  code: string;
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
  const dir = await mkdtemp(join(tmpdir(), 'texuli-pages-graph-'));
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

const entriesOf = (chunks: Map<string, Chunk>) =>
  [...chunks.values()].filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);

const everyModule = (chunks: Map<string, Chunk>) =>
  [...chunks.values()].flatMap((chunk) => chunk.modules);

/** Every trace of the player in a build: its modules, and any specifier left in the code. */
function playerTraces(chunks: Map<string, Chunk>): string[] {
  const traces: string[] = [];
  for (const chunk of chunks.values()) {
    for (const id of chunk.modules)
      if (id.includes('/player/src/') || id.includes('/@texuli/player/')) traces.push(id);
    if (chunk.code.includes('@texuli/player')) traces.push(`${chunk.fileName}: specifier`);
  }
  return traces;
}

const gzipOf = (chunks: readonly Chunk[]) =>
  chunks.reduce((sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length, 0);

describe('the pages bundle graph (G123)', () => {
  it('a host on every core entry with no loader has no @texuli/player in its graph', async () => {
    const chunks = await buildHost(`<script lang="ts">
import { PageEditorCore } from ${at('editor/core.ts')};
import { PageReaderCore } from ${at('reader/core.ts')};
import { PagedViewCore } from ${at('paged/core.ts')};
import { CollabEditorCore } from ${at('collab/core.ts')};
import { createDocumentPlayerHostCore } from ${at('host/core.ts')};
let { doc, session }: { doc: never; session: never } = $props();
const documentHost = createDocumentPlayerHostCore();
</script>
<PageEditorCore document={doc} />
<PageReaderCore document={doc} />
<PagedViewCore document={doc} />
<CollabEditorCore {session} />
<p data-host={typeof documentHost.present}></p>
`);
    const every = everyModule(chunks);
    // Not vacuous: the cores and the embed view are in the build...
    for (const suffix of [
      '/pages/src/editor/PageEditorCore.svelte',
      '/pages/src/reader/PageReaderCore.svelte',
      '/pages/src/paged/PagedViewCore.svelte',
      '/pages/src/collab/CollabEditorCore.svelte',
      '/pages/src/host/document-host-core.ts',
      '/pages/src/shared/EmbedView.svelte',
    ])
      expect(
        every.some((id) => id.endsWith(suffix)),
        suffix
      ).toBe(true);
    // ...and nothing reaches the player: no module, no lazy chunk, no specifier.
    expect(playerTraces(chunks)).toEqual([]);
    expect(every.filter((id) => id.endsWith('/pages/src/shared/player.ts'))).toEqual([]);
    console.info(
      `[bundle-graph] pages core host: every chunk ${gzipOf([...chunks.values()])} B gzip in ${chunks.size} chunks`
    );
  }, 180_000);

  it('a core host that injects its own loader reaches the player from host code, as a lazy chunk', async () => {
    const chunks = await buildHost(`<script lang="ts">
import { PageEditorCore } from ${at('editor/core.ts')};
let { doc }: { doc: never } = $props();
const loadPlayer = () => import(${PLAYER});
</script>
<PageEditorCore document={doc} {loadPlayer} />
`);
    const entries = entriesOf(chunks);
    const initial = staticChunks(chunks, entries).flatMap((chunk) => chunk.modules);
    expect(initial.filter((id) => id.includes('/player/src/'))).toEqual([]);
    expect(everyModule(chunks).some((id) => id.endsWith('/player/src/index.ts'))).toBe(true);
  }, 180_000);

  it('the default entries still reach the player, lazily, with no loader and no embeds', async () => {
    const chunks = await buildHost(`<script lang="ts">
import { PageEditor } from ${at('editor/index.ts')};
import { PageReader } from ${at('reader/index.ts')};
import { createDocumentPlayerHost } from ${at('host/index.ts')};
let { doc }: { doc: never } = $props();
const documentHost = createDocumentPlayerHost();
</script>
<PageEditor document={doc} />
<PageReader document={doc} />
<p data-host={typeof documentHost.present}></p>
`);
    const entries = entriesOf(chunks);
    const initial = staticChunks(chunks, entries);
    expect(
      initial.flatMap((chunk) => chunk.modules).filter((id) => id.includes('/player/src/'))
    ).toEqual([]);
    const lazy = [...chunks.values()].find((chunk) =>
      chunk.modules.some((id) => id.endsWith('/player/src/index.ts'))
    );
    expect(lazy, 'the player chunk').toBeTruthy();
    expect(entries).not.toContain(lazy?.fileName);
    const player = [...chunks.values()].filter((chunk) =>
      chunk.modules.some((id) => id.includes('/player/src/'))
    );
    console.info(
      `[bundle-graph] pages default host: every chunk ${gzipOf([...chunks.values()])} B gzip in ${chunks.size} chunks; player chunks ${gzipOf(player)} B gzip`
    );
  }, 180_000);
});

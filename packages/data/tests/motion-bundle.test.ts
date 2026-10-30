// @vitest-environment node
/**
 * List motion loads lazily (G86): the Board, the DataGrid and the Dashboard
 * take list motion through a small local shim (`src/motion/lazy-list-motion.ts`)
 * that loads `texuli/motion` with `import()` once a mounted list could
 * animate a change. Nothing of `texuli/motion` (the seams, the contract, the
 * provider context) nor the runtime on `@texuli/core/motion` is in the
 * initial graph of their entries; the list seam and the runtime sit in
 * chunks loaded later. Each entry is built the way `pnpm size` builds it
 * (Vite, minified, `svelte` external), and the chunk graph is read from the
 * output.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/** Module id fragments never in the initial graph of a data view entry. */
const NEVER_INITIAL = ['/texuli/src/motion/', '/core/src/motion/'];

/** ...that are still bundled, in chunks loaded with `import()`. */
const LAZY = ['/texuli/src/motion/seam.ts', '/texuli/src/motion/runtime.ts', '/core/src/motion/'];

interface Chunk {
  isEntry: boolean;
  imports: readonly string[];
  modules: readonly string[];
}

async function buildEntry(file: string): Promise<Map<string, Chunk>> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  const dir = await mkdtemp(join(tmpdir(), 'texuli-data-motion-'));
  try {
    const main = join(dir, 'entry.js');
    await writeFile(main, `export * from ${JSON.stringify(file)};\n`);
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
    for (const output of outputs) {
      if (output.type !== 'chunk') continue;
      chunks.set(output.fileName, {
        isEntry: output.isEntry,
        imports: output.imports,
        modules: Object.keys(output.modules).map((id) => id.replaceAll('\\', '/')),
      });
    }
    return chunks;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The modules of the entry chunk and every chunk it imports statically. */
function initialModules(chunks: Map<string, Chunk>): string[] {
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (seen.has(name) || !chunks.has(name)) return;
    seen.add(name);
    for (const imported of chunks.get(name)?.imports ?? []) visit(imported);
  };
  for (const [name, chunk] of chunks) if (chunk.isEntry) visit(name);
  return [...seen].flatMap((name) => chunks.get(name)?.modules ?? []);
}

describe('list motion in the data entries', () => {
  it('keeps texuli/motion and the motion runtime out of the initial graph', async () => {
    for (const entry of ['board', 'grid-core', 'dashboard']) {
      const chunks = await buildEntry(`${SRC}/${entry}/index.ts`);
      const initial = initialModules(chunks);
      const all = [...chunks.values()].flatMap((chunk) => chunk.modules);
      // The entry does take list motion, through the small shim.
      expect(
        initial.some((id) => id.endsWith('/data/src/motion/lazy-list-motion.ts')),
        entry
      ).toBe(true);
      for (const fragment of NEVER_INITIAL) {
        expect(
          initial.filter((id) => id.includes(fragment)),
          `${entry}: ${fragment}`
        ).toEqual([]);
      }
      for (const fragment of LAZY) {
        expect(
          all.some((id) => id.includes(fragment)),
          `${entry}: ${fragment}`
        ).toBe(true);
      }
    }
  }, 120_000);
});

// @vitest-environment node
/// <reference types="node" />
/**
 * Every @texuli/blocks family engine subpath (plus formula and code/tokenizer)
 * must:
 * 1. Import in plain Node (no DOM, no Svelte runtime).
 * 2. Bundle with Vite or esbuild without the Svelte plugin, with zero
 *    .svelte modules reachable in the graph (Protoyard hosts that parse
 *    blocks without a Svelte plugin depend on this).
 *
 * Family entries keep loaders that dynamic-import .svelte views; engines must
 * never pull those loaders.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CODE_GRAMMAR_LANGUAGES, resolveCodeLanguage } from '../src/code/engine-entry.ts';
import { parseFormula } from '../src/core/formula/index.ts';
import { DIAGRAM_LIMITS, layoutFlow, parseDiagram } from '../src/diagram/engine.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(ROOT, '../..');
const SRC = join(ROOT, 'src');

type EsbuildBuild = (options: {
  entryPoints: string[];
  bundle: boolean;
  write: boolean;
  format: 'esm';
  platform: 'neutral';
  target: string;
  logLevel: 'silent';
  metafile: boolean;
  plugins: [];
  external: string[];
}) => Promise<{
  outputFiles?: Array<{ text: string }>;
  metafile?: { inputs?: Record<string, unknown> };
}>;

async function loadEsbuild(): Promise<{ build: EsbuildBuild }> {
  const require = createRequire(join(REPO, 'package.json'));
  const esbuildPath = require.resolve('esbuild');
  return import(pathToFileURL(esbuildPath).href) as Promise<{ build: EsbuildBuild }>;
}

/** Engine (and sibling pure) subpaths published for Svelte-free hosts. */
const ENGINE_ENTRIES: ReadonlyArray<{
  exportPath: string;
  file: string;
  /** Symbols that must survive minification roughly (substring match). */
  mustInclude: readonly string[];
}> = [
  {
    exportPath: './code/engine',
    file: join(SRC, 'code/engine-entry.ts'),
    mustInclude: ['resolveCodeLanguage', 'CODE_GRAMMAR'],
  },
  {
    exportPath: './code/tokenizer',
    file: join(SRC, 'code/engine.ts'),
    mustInclude: ['tokenizeCode'],
  },
  {
    exportPath: './data/engine',
    file: join(SRC, 'data/engine.ts'),
    mustInclude: ['parseDataBlock', 'DATA_BLOCK'],
  },
  {
    exportPath: './diagram/engine',
    file: join(SRC, 'diagram/engine.ts'),
    mustInclude: ['layoutFlow', 'DIAGRAM_LIMITS', 'parseDiagram'],
  },
  {
    exportPath: './embed/engine',
    file: join(SRC, 'embed/engine.ts'),
    mustInclude: ['createSandboxedEmbed', 'EMBED_IFRAME'],
  },
  {
    exportPath: './formula',
    file: join(SRC, 'core/formula/index.ts'),
    mustInclude: ['parseFormula'],
  },
  {
    exportPath: './interactive/engine',
    file: join(SRC, 'interactive/engine.ts'),
    mustInclude: ['parseInteractive', 'parseFormula'],
  },
  {
    exportPath: './map/engine',
    file: join(SRC, 'map/engine.ts'),
    mustInclude: ['parseMapBlock', 'MAP_LIMITS'],
  },
  {
    exportPath: './media/engine',
    file: join(SRC, 'media/engine.ts'),
    mustInclude: ['checkMediaBlock', 'MEDIA_BLOCK'],
  },
  {
    exportPath: './structure/engine',
    file: join(SRC, 'structure/engine.ts'),
    mustInclude: ['STRUCTURE_BLOCK', 'parseStructure'],
  },
  {
    exportPath: './text/engine',
    file: join(SRC, 'text/engine.ts'),
    mustInclude: ['TEXT_BLOCK', 'checkTextBlock'],
  },
];

/** Markers that prove a Svelte renderer or loader leaked into the engine graph. */
const FORBIDDEN = [
  '.svelte',
  'svelte/internal',
  'create_fragment',
  'loadCodeFamily',
  'loadDiagramFamily',
  'loadDataFamily',
  'loadTextFamily',
  'loadMediaFamily',
  'loadStructureFamily',
  'loadInteractiveFamily',
  'loadMapFamily',
  'loadEmbedFamily',
  'CodeBlockView.svelte',
  'DiagramFamily.svelte',
  'DataBlockView.svelte',
  'TextBlockView.svelte',
  'MediaBlockView.svelte',
  'StructureFamily.svelte',
  'InteractiveBlockView.svelte',
  'MapBlockView.svelte',
  'EmbedBlockView.svelte',
  'from "svelte"',
  "from 'svelte'",
] as const;

describe('@texuli/blocks engine exports map', () => {
  it('publishes every engine subpath on package.json exports', () => {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as {
      exports: Record<string, string | Record<string, string>>;
    };
    for (const entry of ENGINE_ENTRIES) {
      const target = pkg.exports[entry.exportPath];
      expect(target, entry.exportPath).toBeDefined();
      if (target === undefined) continue;
      const path = typeof target === 'string' ? target : (target.default ?? target.types ?? '');
      expect(path.length, entry.exportPath).toBeGreaterThan(0);
      // Engines never point at a .svelte file.
      expect(String(path).includes('.svelte'), entry.exportPath).toBe(false);
    }
  });
});

describe('@texuli/blocks engine plain-Node import', () => {
  it('loads each engine module without DOM globals', async () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    for (const entry of ENGINE_ENTRIES) {
      const mod = await import(pathToFileURL(entry.file).href);
      expect(mod, entry.exportPath).toBeTypeOf('object');
      expect(Object.keys(mod).length, entry.exportPath).toBeGreaterThan(0);
    }
  });

  it('exposes diagram layoutFlow + DIAGRAM_LIMITS and code language resolve', () => {
    expect(DIAGRAM_LIMITS.flowNodes).toBeGreaterThan(0);
    const parsed = parseDiagram({
      type: 'flow',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.type === 'flow') {
      const layout = layoutFlow(parsed.data);
      expect(layout.positions.length).toBe(2);
    }
    expect(resolveCodeLanguage('typescript')).toBe('ts');
    expect(CODE_GRAMMAR_LANGUAGES.includes('ts')).toBe(true);
    expect(parseFormula({ op: 'num', value: 1 }).success).toBe(true);
  });
});

describe('@texuli/blocks engine Vite build without Svelte plugin', () => {
  const bundles = new Map<string, string>();
  let workDir = '';

  beforeAll(async () => {
    const { build } = await import('vite');
    workDir = await mkdtemp(join(tmpdir(), 'texuli-blocks-engine-'));
    for (const entry of ENGINE_ENTRIES) {
      const stubName = entry.exportPath.split('/').join('_').split('.').join('_');
      const stub = join(workDir, `${stubName}.js`);
      await writeFile(stub, `export * from ${JSON.stringify(pathToFileURL(entry.file).href)};\n`);
      const result = await build({
        configFile: false,
        logLevel: 'silent',
        mode: 'production',
        root: workDir,
        // No @sveltejs/vite-plugin-svelte — engines must parse as plain JS/TS.
        plugins: [],
        build: {
          write: false,
          minify: true,
          target: 'es2022',
          lib: { entry: stub, formats: ['es'], fileName: 'engine' },
          rollupOptions: {
            external: (id: string) =>
              id === 'svelte' ||
              id.startsWith('svelte/') ||
              id === 'esbuild' ||
              // workspace peers that are themselves Svelte-free engines are bundled
              false,
          },
        },
      });
      const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
        'output' in item ? item.output : []
      );
      const code = outputs
        .filter((file) => file.type === 'chunk')
        .map((file) => ('code' in file ? file.code : ''))
        .join('\n');
      bundles.set(entry.exportPath, code);
    }
  }, 180_000);

  afterAll(async () => {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  });

  for (const entry of ENGINE_ENTRIES) {
    it(`Vite-bundles ${entry.exportPath} with no .svelte reachable`, () => {
      const code = bundles.get(entry.exportPath) ?? '';
      expect(code.length, entry.exportPath).toBeGreaterThan(50);
      for (const needle of FORBIDDEN) {
        expect(code.includes(needle), `${entry.exportPath} must not contain ${needle}`).toBe(false);
      }
      for (const keep of entry.mustInclude) {
        expect(code.includes(keep), `${entry.exportPath} should retain ${keep}`).toBe(true);
      }
    });
  }
});

describe('@texuli/blocks engine esbuild without Svelte plugin', () => {
  for (const entry of ENGINE_ENTRIES) {
    it(`esbuild-bundles ${entry.exportPath} with no .svelte reachable`, async () => {
      const { build } = await loadEsbuild();
      const result = await build({
        entryPoints: [entry.file],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'neutral',
        target: 'es2022',
        logLevel: 'silent',
        metafile: true,
        // No svelte plugin; .svelte files must not appear in the module graph.
        plugins: [],
        external: ['svelte', 'svelte/*'],
      });
      const code = (result.outputFiles ?? []).map((f) => f.text).join('\n');
      expect(code.length).toBeGreaterThan(50);
      for (const needle of FORBIDDEN) {
        expect(
          code.includes(needle),
          `${entry.exportPath} esbuild must not contain ${needle}`
        ).toBe(false);
      }
      const svelteInputs = Object.keys(result.metafile?.inputs ?? {}).filter((p) =>
        p.endsWith('.svelte')
      );
      expect(code.includes('.svelte')).toBe(false);
      expect(svelteInputs).toEqual([]);
    });
  }
});

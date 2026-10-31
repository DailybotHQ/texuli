// @vitest-environment node
/**
 * The bundle a host gets (G119): a form of text, select and checkbox fields
 * must not carry the controls it never paints. SchemaForm loads the date and
 * time pickers, the slider, the file upload, the tags input, the color
 * picker and the radio group per field type, and the step navigation only
 * for a multi-step form, so neither those components
 * nor their CSS are in the host's initial graph; they sit in lazy chunks.
 * A host that passes the static registry (`@texuli/forms/controls`, for
 * server rendering) has them eagerly, by choice. Each host is built the way
 * `pnpm size` builds an entry (Vite, minified, `svelte` external, split CSS)
 * and the chunk graph is read from the output.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/** Module id fragments of the per-type controls (component and stylesheet). */
const LAZY_ONLY = [
  '/texuli/src/components/date/DatePicker.svelte',
  '/texuli/src/components/date/TimeField.svelte',
  '/texuli/src/components/date/date.css',
  '/texuli/src/components/slider/',
  '/texuli/src/components/file-upload/',
  '/texuli/src/components/tags-color/',
  '/texuli/src/components/choice/RadioGroup.svelte',
  // The step navigation of multi-step forms.
  '/texuli/src/components/stepper/',
];

interface Chunk {
  fileName: string;
  code: string;
  isEntry: boolean;
  imports: readonly string[];
  dynamicImports: readonly string[];
  modules: readonly string[];
  css: readonly string[];
}

interface Graph {
  chunks: Map<string, Chunk>;
  assets: Map<string, string>;
}

async function buildHost(source: string): Promise<Graph> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  const dir = await mkdtemp(join(tmpdir(), 'texuli-forms-graph-'));
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
        cssCodeSplit: true,
        reportCompressedSize: false,
        lib: { entry: main, formats: ['es'], fileName: 'entry', cssFileName: 'entry' },
        rollupOptions: { external: (id: string) => id === 'svelte' || id.startsWith('svelte/') },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
      'output' in item ? item.output : []
    );
    const chunks = new Map<string, Chunk>();
    const assets = new Map<string, string>();
    for (const file of outputs) {
      if (file.type === 'asset') {
        if (file.fileName.endsWith('.css')) assets.set(file.fileName, String(file.source));
        continue;
      }
      const meta = (file as { viteMetadata?: { importedCss?: Set<string> } }).viteMetadata;
      chunks.set(file.fileName, {
        fileName: file.fileName,
        code: file.code,
        isEntry: file.isEntry,
        imports: file.imports,
        dynamicImports: file.dynamicImports,
        modules: Object.keys(file.modules).map((id) => id.replaceAll('\\', '/')),
        css: [...(meta?.importedCss ?? [])],
      });
    }
    return { chunks, assets };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The entry chunks and every chunk they import statically. */
function initial(graph: Graph): Chunk[] {
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (seen.has(name) || !graph.chunks.has(name)) return;
    seen.add(name);
    for (const imported of graph.chunks.get(name)?.imports ?? []) visit(imported);
  };
  for (const [name, chunk] of graph.chunks) if (chunk.isEntry) visit(name);
  return [...seen].flatMap((name) => graph.chunks.get(name) ?? []);
}

/** Gzip sizes of the initial JavaScript and CSS (as `pnpm size` counts them). */
function initialSizes(graph: Graph): { js: number; css: number } {
  const chunks = initial(graph);
  const css = new Set(chunks.flatMap((chunk) => chunk.css));
  // A library build may also emit one CSS file for the entry.
  if (graph.assets.has('entry.css')) css.add('entry.css');
  const text = [...css].map((name) => graph.assets.get(name) ?? '').join('');
  return {
    js: gzipSync(chunks.map((chunk) => chunk.code).join(''), { level: 9 }).length,
    css: text ? gzipSync(text, { level: 9 }).length : 0,
  };
}

const COMMON = {
  title: 'Contact',
  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true },
    {
      name: 'topic',
      type: 'select',
      label: 'Topic',
      options: [
        { value: 'sales', label: 'Sales' },
        { value: 'support', label: 'Support' },
      ],
    },
    { name: 'updates', type: 'checkbox', label: 'Send me updates' },
  ],
};

/** Protoyard's measure (G119): a form of text fields only. */
const TEXT_ONLY = {
  title: 'Profile',
  fields: [
    { name: 'first', type: 'text', label: 'First name', required: true },
    { name: 'last', type: 'text', label: 'Last name' },
    { name: 'bio', type: 'textarea', label: 'Bio' },
  ],
};

const host = (registry: boolean, schema: unknown = COMMON) => `<script lang="ts">
import { SchemaForm } from ${JSON.stringify(`${SRC}/index.ts`)};
import { validateFormSchema } from ${JSON.stringify(`${SRC}/model/index.ts`)};
${registry ? `import { SCHEMA_FORM_CONTROLS } from ${JSON.stringify(`${SRC}/view/controls/index.ts`)};` : ''}
const result = validateFormSchema(${JSON.stringify(schema)});
if (!result.ok) throw new Error('invalid schema');
</script>
<SchemaForm form={result.form}${registry ? ' controls={SCHEMA_FORM_CONTROLS}' : ''} />
`;

describe('SchemaForm bundle graph (G119)', () => {
  it('keeps the per-type controls and their CSS out of a text/select/checkbox form', {
    timeout: 240_000,
  }, async () => {
    const graph = await buildHost(host(false));
    const eager = initial(graph).flatMap((chunk) => chunk.modules);
    for (const fragment of LAZY_ONLY) {
      expect(
        eager.filter((id) => id.includes(fragment)),
        `${fragment} in the initial graph`
      ).toEqual([]);
    }
    // They are still reachable, lazily, for forms that use them.
    const lazy = [...graph.chunks.values()]
      .filter((chunk) => !initial(graph).includes(chunk))
      .flatMap((chunk) => chunk.modules);
    expect(lazy.some((id) => id.includes('/texuli/src/components/date/DatePicker.svelte'))).toBe(
      true
    );
    const sizes = initialSizes(graph);
    // Reported for the release notes (G119 before and after).
    console.info(
      `G119 text/select/checkbox form: initial JS ${sizes.js} B, CSS ${sizes.css} B gzip`
    );
    // The eager CSS of the common case is field, input, select, choice, button
    // and the form layout. Measured before G119: JS 90,507 B, CSS 9,385 B.
    expect(sizes.css).toBeLessThan(5500);
    expect(sizes.js).toBeLessThan(70_000);
  });

  it('keeps the per-type controls and their CSS and JS out of a text-only form', {
    timeout: 240_000,
  }, async () => {
    const graph = await buildHost(host(false, TEXT_ONLY));
    const eager = initial(graph).flatMap((chunk) => chunk.modules);
    for (const fragment of LAZY_ONLY) {
      expect(
        eager.filter((id) => id.includes(fragment)),
        `${fragment} in the initial graph`
      ).toEqual([]);
    }
    const sizes = initialSizes(graph);
    console.info(`G119 text-only form: initial JS ${sizes.js} B, CSS ${sizes.css} B gzip`);
    // Measured before G119: JS 90,466 B, CSS 9,385 B.
    expect(sizes.css).toBeLessThan(5500);
    expect(sizes.js).toBeLessThan(70_000);
  });

  it('puts every control in the initial graph when the host passes the static registry (SSR)', {
    timeout: 240_000,
  }, async () => {
    const graph = await buildHost(host(true));
    const eager = initial(graph).flatMap((chunk) => chunk.modules);
    for (const fragment of LAZY_ONLY) {
      expect(
        eager.some((id) => id.includes(fragment)),
        `${fragment} with the registry`
      ).toBe(true);
    }
  });
});

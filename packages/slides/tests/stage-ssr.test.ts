// @vitest-environment node
/**
 * The server render keeps the slides (no-JS readers and crawlers). The default
 * renderer tables, their layouts and the built-in block support load on first
 * use in the browser, so a server build preloads them before it renders
 * (`./src/stage/ssr-server.ts`, picked by the `#deck-ssr` import's default
 * condition; a browser build takes the empty `browser` one). The host is built
 * the way a Vite host builds its server bundle (`build.ssr`, `svelte`
 * external) and rendered in a separate Node process with `svelte/server`.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');
// Inside the repository, so the bundle resolves `svelte` from its node_modules.
const SCRATCH = resolve(HERE, '../../../tmp');

const slides = {
  hero: { id: 'hero', layout: 'title-hero', props: { title: 'Small pieces on the server' } },
  quote: { id: 'q', layout: 'quote', props: { quote: 'Infinite possibilities.' } },
  free: {
    id: 'free',
    layout: 'free',
    blocks: [{ type: 'text', markdown: 'A **free** slide paragraph.' }],
  },
};

const deckOf = (...list: unknown[]) => ({
  formatVersion: 2,
  meta: { title: 'Server deck' },
  slides: list,
});

const HOST = `<script lang="ts">
import { DeckStage } from ${JSON.stringify(`${SRC}/stage/index.ts`)};
let { deck }: { deck: unknown } = $props();
</script>
<DeckStage {deck} loadTheme={null} syncHash={false} />
`;

async function serverRender(host: string, deck: unknown): Promise<string> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'slides-ssr-'));
  try {
    await writeFile(join(dir, 'Host.svelte'), host);
    const main = join(dir, 'entry.js');
    await writeFile(
      main,
      [
        "import { render } from 'svelte/server';",
        "import Host from './Host.svelte';",
        `const { head, body } = render(Host, { props: { deck: ${JSON.stringify(deck)} } });`,
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
      maxBuffer: 64 * 1024 * 1024,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('DeckStage on the server', () => {
  it('renders layout slides, not a loading status, with the default renderers', async () => {
    const html = await serverRender(HOST, deckOf(slides.hero, slides.quote, slides.free));
    expect(html).toContain('data-slide-id="hero"');
    expect(html).toContain('Small pieces on the server');
    // The next slide is mounted (inert) too.
    expect(html).toContain('Infinite possibilities.');
    expect(html).not.toContain('Loading slide content');
    expect(html).not.toContain('aria-busy="true"');
  }, 180_000);

  it('renders free-slide blocks through the preloaded block families', async () => {
    const html = await serverRender(HOST, deckOf(slides.free, slides.hero));
    expect(html).toContain('data-slide-id="free"');
    // Without Svelte's hydration markers, the paragraph is plain HTML.
    expect(html.replaceAll(/<!--[^>]*-->/g, '')).toContain(
      '<p>A <strong>free</strong> slide paragraph.</p>'
    );
    expect(html).not.toContain('Loading slide content');
  }, 180_000);
});

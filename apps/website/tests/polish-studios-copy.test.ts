/**
 * T-82 — the studios' trust voice and in-UI affordances survive the polish
 * (punch-list rows 4, 5 and 9). The vitest suite cannot compile islands, so
 * the page shells and island sources are pinned at the source level: the
 * checkable trust sentences stay verbatim, and every new affordance carries
 * its marker and honest copy.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
}

function read(path: string): string {
  return readFileSync(resolve(repoRoot(), path), 'utf8');
}

describe('the trust voice stays verbatim (punch-list row 9)', () => {
  it('keeps each tool honesty sentence word for word', () => {
    expect(read('apps/website/src/pages/theme-studio/index.astro')).toContain(
      'Nothing leaves this origin.'
    );
    expect(read('apps/website/src/pages/builder/index.astro')).toContain(
      'Drafts stay untrusted and are never activated here.'
    );
    expect(read('apps/website/src/pages/playground/index.astro')).toContain(
      'Nothing here executes agent HTML or loads remote code.'
    );
  });

  it('keeps the island sources free of HTML sinks', () => {
    for (const file of [
      'apps/website/src/components/theme-studio/ThemeStudio.svelte',
      'apps/website/src/components/playground/PlaygroundApp.svelte',
      'apps/website/src/components/builder/BuilderApp.svelte',
      'apps/website/src/components/color-explorer/ColorExplorer.svelte',
    ]) {
      expect(read(file), file).not.toMatch(/\{@html/);
    }
  });
});

describe('theme studio affordances (rows 2, 4, 8)', () => {
  const island = read('apps/website/src/components/theme-studio/ThemeStudio.svelte');

  it('starts from preset seeds and library themes, budgeted', () => {
    expect(island).toContain('data-tx-studio-seed-preset=');
    expect(island).toContain('data-tx-studio-library=');
    expect(island).toContain('loadThemeData');
    expect(island).toContain('gallery-themes/');
    // The full library never ships in the page: only featured ids render.
    expect(island).toContain('FEATURED_LIBRARY_THEMES');
  });

  it('documents the keyboard map in the UI', () => {
    expect(island).toContain('data-tx-studio-keys');
    expect(island).toContain('do not fire while you type in a field');
    expect(island).toContain('toolShortcut');
  });

  it('offers a local, decodes-locally share link', () => {
    expect(island).toContain('Copy share link');
    expect(island).toContain('decodes right here');
    expect(island).toContain('encodeStudioShare');
    expect(island).toContain('decodeStudioShare');
  });

  it('tells the visitor the share link never carries an image', () => {
    expect(island).toMatch(/never\s+an image/);
  });
});

describe('playground affordances (row 5)', () => {
  const island = read('apps/website/src/components/playground/PlaygroundApp.svelte');
  const page = read('apps/website/src/pages/playground/index.astro');

  it('surfaces a preset carousel with what each run proves', () => {
    expect(island).toContain('data-tx-playground-preset=');
    expect(island).toContain('what each one proves');
    expect(island).toContain('aria-pressed=');
  });

  it('keeps the preset select for pointer- and keyboard-quick access', () => {
    expect(island).toContain('aria-label="Preset"');
  });

  it('leads with the neutralization mechanic', () => {
    expect(page).toContain('watch the sink-free renderer keep only what a safe host');
  });
});

describe('explorer, search, editor and slides', () => {
  it('documents the explorer keyboard map and names its export region', () => {
    const explorer = read('apps/website/src/components/color-explorer/ColorExplorer.svelte');
    expect(explorer).toContain('data-tx-explorer-keys');
    expect(explorer).toContain('aria-label="Export output, scrollable"');
  });

  it('gives the search page a form that works with JavaScript off', () => {
    const page = read('apps/website/src/pages/search/index.astro');
    expect(page).toContain('method="get"');
    expect(page).toContain('name="q"');
    expect(page).toContain('role="search"');
  });

  it('keeps the editor and slides keyboard lists on the page', () => {
    expect(read('apps/website/src/pages/editor-page/index.astro')).toContain(
      'an unsafe address such as'
    );
    expect(read('apps/website/src/pages/slides-page/index.astro')).toContain(
      'reveal the next step'
    );
  });
});

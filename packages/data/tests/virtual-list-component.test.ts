/// <reference types="node" />
/**
 * `VirtualListView` (catalog `data-virtual-list`, ADR-032): a windowed APG
 * listbox. 10,000 rows render as a window; spacers are component-owned and
 * sized by a custom property; scrolling, keyboard, dynamic measurement,
 * selection, `aria-setsize`/`aria-posinset`, server rendering of the first
 * window, the catalog entry and hostile input.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { checkTokenReads } from '@texuli/tokens/components';
import { createRawSnippet, flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMPORTS_BY_ID } from '../../catalog/src/manifest/imports-map.ts';
import { DATA_GRAMMAR_ROLES, DATA_MANIFESTS } from '../../catalog/src/manifests/data/index.ts';
import {
  VIRTUAL_LIST_DENSITIES,
  VIRTUAL_LIST_SIZES,
  VirtualListView,
  virtualListKeyOf,
  virtualListLabelOf,
} from '../src/virtual-list/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SCRATCH = join(ROOT, 'tmp');
const css = readFileSync(
  join(ROOT, 'packages/data/src/virtual-list/virtual-list-view.css'),
  'utf8'
);
const source = readFileSync(
  join(ROOT, 'packages/data/src/virtual-list/VirtualListView.svelte'),
  'utf8'
);

type Row = { id: string; label: string; description?: string };
const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `r${index}`,
    label: `Update ${index + 1}`,
    description: index % 2 === 0 ? 'Posted to the example.com team' : undefined,
  }));
const TEN_THOUSAND = rows(10_000);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const listbox = (container: HTMLElement) =>
  container.querySelector('[role="listbox"]') as HTMLElement;
const options = (container: HTMLElement) =>
  [...container.querySelectorAll('[role="option"]')] as HTMLElement[];
const spacer = (container: HTMLElement, which: 'before' | 'after') =>
  container.querySelector(`[data-tx-virtual-list-spacer="${which}"]`) as HTMLElement;
const spacerPx = (container: HTMLElement, which: 'before' | 'after') =>
  Number.parseFloat(spacer(container, which).style.getPropertyValue('--tx-virtual-list-spacer'));

function scrollTo(container: HTMLElement, top: number): void {
  const box = listbox(container);
  box.scrollTop = top;
  fireEvent.scroll(box);
  flushSync();
}

describe('windowing 10,000 rows', () => {
  it('renders only a window, with spacers that keep the full height', () => {
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed' },
    });
    const visible = options(container);
    // md assumes a 384 px viewport before measuring: 10 rows plus 3 overscan.
    expect(visible.length).toBe(13);
    expect(visible[0]?.textContent).toContain('Update 1');
    expect(spacerPx(container, 'before')).toBe(0);
    expect(spacerPx(container, 'after')).toBe((10_000 - 13) * 40);
    for (const which of ['before', 'after'] as const)
      expect(spacer(container, which).getAttribute('aria-hidden')).toBe('true');
  });

  it('announces every row with its position in the full list', () => {
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed' },
    });
    expect(listbox(container).getAttribute('aria-label')).toBe('Team feed');
    options(container).forEach((option, index) => {
      expect(option.getAttribute('aria-setsize')).toBe('10000');
      expect(option.getAttribute('aria-posinset')).toBe(String(index + 1));
      expect(option.getAttribute('aria-selected')).toBe('false');
    });
  });

  it('moves the window as the list scrolls', () => {
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed' },
    });
    scrollTo(container, 200_000); // row 5,000
    const visible = options(container);
    expect(visible[0]?.getAttribute('aria-posinset')).toBe('4998');
    expect(visible.at(-1)?.getAttribute('aria-posinset')).toBe('5013');
    expect(spacerPx(container, 'before')).toBe(4997 * 40);
    expect(spacerPx(container, 'before') + visible.length * 40 + spacerPx(container, 'after')).toBe(
      400_000
    );
    scrollTo(container, 10_000 * 40);
    expect(options(container).at(-1)?.getAttribute('aria-posinset')).toBe('10000');
    expect(spacerPx(container, 'after')).toBe(0);
  });

  it('honors overscan and estimateSize', () => {
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Feed', estimateSize: 96, overscan: 0, size: 'sm' },
    });
    // sm assumes 256 px: rows 0..2 at 96 px each, no overscan.
    expect(options(container).length).toBe(3);
    expect(spacerPx(container, 'after')).toBe((10_000 - 3) * 96);
  });

  it('reports the rendered range for an infinite loader', () => {
    const onRangeChange = vi.fn();
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Feed', onRangeChange },
    });
    expect(onRangeChange).toHaveBeenLastCalledWith({ start: 0, end: 13 });
    scrollTo(container, 40 * 100);
    expect(onRangeChange).toHaveBeenLastCalledWith({ start: 97, end: 113 });
  });
});

describe('keyboard: the APG listbox pattern', () => {
  it('is one tab stop and moves the active option with arrows, Home, End and pages', async () => {
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed' },
    });
    const box = listbox(container);
    expect(box.tabIndex).toBe(0);
    for (const option of options(container)) expect(option.hasAttribute('tabindex')).toBe(false);

    await fireEvent.focus(box);
    expect(box.getAttribute('aria-activedescendant')).toBe(options(container)[0]?.id);

    await fireEvent.keyDown(box, { key: 'ArrowDown' });
    await fireEvent.keyDown(box, { key: 'ArrowDown' });
    const active = () => document.getElementById(box.getAttribute('aria-activedescendant') ?? '');
    expect(active()?.getAttribute('aria-posinset')).toBe('3');
    expect(active()?.hasAttribute('data-active')).toBe(true);

    await fireEvent.keyDown(box, { key: 'End' });
    expect(active()?.getAttribute('aria-posinset')).toBe('10000');
    expect(box.scrollTop).toBe(10_000 * 40 - 384);
    expect(options(container).at(-1)?.getAttribute('aria-posinset')).toBe('10000');

    await fireEvent.keyDown(box, { key: 'PageUp' });
    expect(active()?.getAttribute('aria-posinset')).toBe(String(10_000 - 9));

    await fireEvent.keyDown(box, { key: 'Home' });
    expect(active()?.getAttribute('aria-posinset')).toBe('1');
    expect(box.scrollTop).toBe(0);

    await fireEvent.keyDown(box, { key: 'ArrowUp' });
    expect(active()?.getAttribute('aria-posinset')).toBe('1');
  });

  it('selects with Enter, Space and click, and reports the item', async () => {
    const onSelect = vi.fn();
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed', onSelect },
    });
    const box = listbox(container);
    await fireEvent.focus(box);
    await fireEvent.keyDown(box, { key: 'ArrowDown' });
    await fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(TEN_THOUSAND[1], 1);
    expect(options(container)[1]?.getAttribute('aria-selected')).toBe('true');

    await fireEvent.keyDown(box, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);

    await fireEvent.click(options(container)[4] as HTMLElement);
    expect(onSelect).toHaveBeenLastCalledWith(TEN_THOUSAND[4], 4);
    expect(options(container)[1]?.getAttribute('aria-selected')).toBe('false');
    expect(box.getAttribute('aria-activedescendant')).toBe(options(container)[4]?.id);
  });

  it('starts at the selected row when focus arrives', async () => {
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed', selected: 'r2500' },
    });
    const box = listbox(container);
    await fireEvent.focus(box);
    const active = document.getElementById(box.getAttribute('aria-activedescendant') ?? '');
    expect(active?.getAttribute('aria-posinset')).toBe('2501');
    expect(active?.getAttribute('aria-selected')).toBe('true');
  });

  it('drops aria-activedescendant while the active row is scrolled out of the window', async () => {
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed' },
    });
    const box = listbox(container);
    await fireEvent.focus(box);
    expect(box.hasAttribute('aria-activedescendant')).toBe(true);
    scrollTo(container, 40 * 3000);
    expect(box.hasAttribute('aria-activedescendant')).toBe(false);
    await fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(box.getAttribute('aria-activedescendant')).toContain('-option-1');
  });
});

describe('dynamic row measurement', () => {
  it('measures rendered rows and sizes the spacers from real heights', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const index = this.dataset.index;
      const height = index === undefined ? 0 : Number(index) % 2 === 0 ? 80 : 40;
      return {
        height,
        width: 300,
        top: 0,
        left: 0,
        right: 300,
        bottom: height,
        x: 0,
        y: 0,
      } as DOMRect;
    });
    const { container } = render(VirtualListView, {
      props: { items: rows(1000), label: 'Feed', overscan: 0 },
    });
    flushSync();
    // Rows 0, 2, 4… measure 80 px, so fewer rows fill the 384 px viewport.
    const visible = options(container);
    expect(visible.length).toBeLessThan(10);
    const measured = visible.reduce(
      (sum, option) => sum + (Number(option.dataset.index) % 2 === 0 ? 80 : 40),
      0
    );
    expect(measured + spacerPx(container, 'after')).toBe(measured + (1000 - visible.length) * 40);
  });

  it('keeps the content still when a row above the viewport is taller than estimated', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const index = this.dataset.index;
      return { height: index === undefined ? 0 : index === '98' ? 140 : 40 } as DOMRect;
    });
    const { container } = render(VirtualListView, {
      props: { items: rows(1000), label: 'Feed' },
    });
    // Row 100 at the top: row 98 mounts in the overscan above it and measures 140 px.
    scrollTo(container, 40 * 100);
    const box = listbox(container);
    expect(box.scrollTop).toBe(40 * 100 + 100);
    // Row 100 is still the first row in view, now 100 px further down.
    expect(spacerPx(container, 'before') + 2 * 40 + 140).toBe(box.scrollTop);
  });
});

describe('rows through a snippet, with no consumer style', () => {
  it('renders the row snippet with the item, its index and its state', async () => {
    const row = createRawSnippet((context: () => { item: Row; index: number }) => ({
      render: () =>
        `<article class="feed-card"><h3>${context().item.label}</h3><p>#${context().index}</p></article>`,
    }));
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed', row: row as never },
    });
    expect(container.querySelectorAll('article.feed-card').length).toBe(13);
    expect(container.querySelector('[role="option"] h3')?.textContent).toBe('Update 1');
    await fireEvent.focus(listbox(container));
    // The snippet's own markup sits inside the option; the option carries the state.
    expect(options(container)[0]?.hasAttribute('data-active')).toBe(true);
  });

  it('sets inline style only through the component’s spacer custom property', () => {
    const { container } = render(VirtualListView, {
      props: { items: TEN_THOUSAND, label: 'Team feed' },
    });
    const styled = [...container.querySelectorAll('[style]')];
    expect(styled.length).toBe(2);
    for (const element of styled) {
      expect(element.hasAttribute('data-tx-virtual-list-spacer')).toBe(true);
      expect(element.getAttribute('style')).toMatch(/^--tx-virtual-list-spacer: \d+(\.\d+)?px;?$/);
    }
    // In source: style directives on the spacers only, never a style attribute or {@html}.
    expect(source.match(/style:/g)?.length).toBe(2);
    expect(source).not.toMatch(/\sstyle=|\{@html/);
  });
});

/**
 * Server HTML, built the way a Vite host builds its server bundle and
 * rendered in a separate Node process with `svelte/server`, as the
 * dashboard SSR test does.
 */
async function serverRender(host: string): Promise<string> {
  const [{ build }, { svelte }] = await Promise.all([
    import('vite'),
    import('@sveltejs/vite-plugin-svelte'),
  ]);
  await mkdir(SCRATCH, { recursive: true });
  const dir = await mkdtemp(join(SCRATCH, 'virtual-list-ssr-'));
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
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('server rendering', () => {
  it('renders the first window before hydration', async () => {
    const entry = JSON.stringify(join(ROOT, 'packages/data/src/virtual-list/index.ts'));
    const body = await serverRender(`<script lang="ts">
import { VirtualListView } from ${entry};
const items = Array.from({ length: 10000 }, (_, i) => ({ id: 'r' + i, label: 'Update ' + (i + 1) }));
</script>
<VirtualListView {items} label="Team feed" />
`);
    expect(body.match(/role="option"/g)?.length).toBe(13);
    expect(body).toContain('aria-setsize="10000"');
    expect(body).toContain('aria-posinset="13"');
    expect(body).not.toContain('aria-posinset="14"');
    expect(body).toContain('data-tx-component="data-virtual-list"');
    expect(body).toContain(`--tx-virtual-list-spacer: ${(10_000 - 13) * 40}px`);
  }, 180_000);
});

describe('root attributes, axes and an empty list', () => {
  it('stamps the component id, size and density, normalizing hostile values', () => {
    const { container } = render(VirtualListView, {
      props: {
        items: rows(5),
        label: 'Feed',
        size: 'lg',
        density: 'compact',
      },
    });
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-tx-component')).toBe('data-virtual-list');
    expect(root.getAttribute('data-tx-size')).toBe('lg');
    expect(root.getAttribute('data-tx-density')).toBe('compact');
    cleanup();
    const hostile = render(VirtualListView, {
      props: { items: rows(5), label: 'Feed', size: 'huge' as never, density: '"><x' as never },
    });
    const other = hostile.container.firstElementChild as HTMLElement;
    expect(other.getAttribute('data-tx-size')).toBe('md');
    expect(other.getAttribute('data-tx-density')).toBe('default');
  });

  it('shows the empty label and leaves the tab order when there are no rows', () => {
    const { container } = render(VirtualListView, {
      props: { items: [], label: 'Feed', emptyLabel: 'Nothing new' },
    });
    expect(options(container)).toEqual([]);
    expect(listbox(container).tabIndex).toBe(-1);
    expect(container.textContent).toContain('Nothing new');
  });

  it('renders untrusted labels as text and never trusts item ids for element ids', () => {
    const items = [
      { id: '"><img src=x onerror=alert(1)>', label: '<script>alert(1)</script>' },
      { id: { toString: () => 'x' }, label: 42 },
      null,
      'plain text',
    ];
    const { container } = render(VirtualListView, {
      props: { items: items as never[], label: 'Feed' },
    });
    expect(container.querySelector('img, script')).toBeNull();
    const texts = options(container).map((option) => option.textContent?.trim());
    expect(texts).toEqual(['<script>alert(1)</script>', 'Item 2', 'Item 3', 'plain text']);
    for (const option of options(container)) expect(option.id).toMatch(/-option-\d+$/);
    expect(virtualListKeyOf({ id: Number.NaN }, 7)).toBe(7);
    expect(virtualListLabelOf(Object.create({ label: 'inherited' }), 0)).toBe('Item 1');
  });

  it('reads tokens and logical properties only', () => {
    expect(checkTokenReads(css)).toEqual([]);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    expect(css).not.toMatch(
      /(?:margin|padding|border)-(?:left|right|top|bottom)\b|\b(?:height|width):/
    );
  });
});

describe('catalog: data-virtual-list', () => {
  const manifest = DATA_MANIFESTS.find((entry) => entry.id === 'data-virtual-list');

  it('is a data manifest with its axes, imports and grammar role', () => {
    expect(manifest).toBeDefined();
    expect(manifest?.package).toBe('@texuli/data');
    expect(manifest?.agentEmittable).toBe(false);
    const props = Object.fromEntries((manifest?.props ?? []).map((prop) => [prop.name, prop]));
    expect(props.size?.enumValues).toEqual([...VIRTUAL_LIST_SIZES]);
    expect(props.density?.enumValues).toEqual([...VIRTUAL_LIST_DENSITIES]);
    expect(manifest?.axes).toEqual({ size: 'size', density: 'density' });
    expect(IMPORTS_BY_ID['data-virtual-list']).toEqual([
      { module: '@texuli/data', exports: ['VirtualListView'] },
      { module: '@texuli/data/virtual-list', exports: ['VirtualListView'] },
    ]);
    expect(DATA_GRAMMAR_ROLES).toContainEqual({ id: 'data-virtual-list', role: 'interactive' });
  });

  it('renders its catalog example as a windowed listbox', () => {
    const props = manifest?.examples?.[0]?.props as { items: Row[]; label: string };
    const { container } = render(VirtualListView, { props });
    expect(container.firstElementChild?.getAttribute('data-tx-component')).toBe(
      'data-virtual-list'
    );
    expect(options(container).length).toBe(props.items.length);
  });
});

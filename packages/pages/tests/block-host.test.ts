// @vitest-environment happy-dom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import type { DocumentBlock, TexuliDocument } from '@texuli/document/model';
import { createRawSnippet, tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import PageEditor from '../src/editor/PageEditor.svelte';
import type { PagesEditor } from '../src/editor/state.svelte.ts';
import PageReader from '../src/reader/PageReader.svelte';
import { blockClaim, readonlyNode } from '../src/shared/block-claim.ts';
import { blockPainter, type PagesBlockHost, type PagesHostNode } from '../src/shared/block-host.ts';
import { doc, para } from './fixtures.ts';
import HostBlockStub from './HostBlockStub.svelte';

/*
 * G111: a host paints its own wrapped blocks and embeds in PageReader and
 * PageEditor (a renderBlock snippet, a blockHost component or a present
 * mount), the library keeps its blocks unless the host claims them, the node
 * is handed read-only, the refused notice stays when nobody paints a node,
 * and a reader or editor without a host never loads the host slot.
 */

const FORM: DocumentBlock = {
  id: 'f',
  type: 'block',
  family: 'interactive',
  block: 'form',
  props: { title: 'Signup <b>', fields: [{ id: 'email', type: 'email' }] },
};
const STAT: DocumentBlock = {
  id: 'stat',
  type: 'block',
  family: 'data',
  block: 'stat',
  props: { items: [{ label: 'Uptime', value: '99.9%' }] },
};
const BY_REF: DocumentBlock = {
  id: 'kpi',
  type: 'embed',
  kind: 'component',
  ref: 'host/kpi',
  title: 'KPI',
};

const wrapper = (id: string) =>
  document.querySelector(`[data-block-id="${id}"], [data-host-node="${id}"]`);
const hostForm = (id: string) =>
  document.querySelector(`[data-tx-pages-host] [data-host-node="${id}"]`);

describe('host block renderer (G111)', () => {
  it('refuses an unknown block without a host, as before', async () => {
    render(PageReader, { props: { document: doc([FORM, BY_REF]) } });
    await waitFor(
      () =>
        expect(document.querySelector('.tx-pages-wrapped')?.hasAttribute('data-refused')).toBe(
          true
        ),
      { timeout: 30_000 }
    );
    await waitFor(() =>
      expect(document.querySelector('figure')?.getAttribute('data-state')).toBe('refused')
    );
    expect(document.querySelector('[data-tx-pages-host]')).toBeNull();
    expect(wrapper('f')).toBeNull();
  }, 60_000);

  it('paints what the library refuses with the host component, and keeps library blocks', async () => {
    const claim = vi.fn((_node: PagesHostNode) => 'fallback' as const);
    render(PageReader, {
      props: {
        document: doc([FORM, STAT, BY_REF]),
        blockHost: { claim, component: HostBlockStub },
      },
    });
    await waitFor(() => expect(hostForm('f')).not.toBeNull(), { timeout: 30_000 });
    // Text, never markup.
    expect(hostForm('f')?.textContent).toContain('Signup <b>');
    expect(hostForm('f')?.querySelector('b')).toBeNull();
    // The component embed with a host ref and no payload: the host paints it too.
    await waitFor(() => expect(hostForm('kpi')).not.toBeNull(), { timeout: 30_000 });
    // The library keeps the stat.
    await waitFor(
      () =>
        expect(
          document.querySelector('.tx-pages-wrapped[data-block-type="stat"]')?.textContent
        ).toContain('99.9%'),
      { timeout: 30_000 }
    );
    expect(hostForm('stat')).toBeNull();
    expect(document.querySelectorAll('[data-refused]')).toHaveLength(0);
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ id: 'f', block: 'form' }));
  }, 60_000);

  it('paints every block the host claims, library blocks too, and refuses what it leaves to the library', async () => {
    render(PageReader, {
      props: {
        document: doc([FORM, STAT]),
        blockHost: {
          claim: (node) => (node.id === 'stat' ? 'host' : 'library'),
          component: HostBlockStub,
        },
      },
    });
    await waitFor(() => expect(hostForm('stat')).not.toBeNull(), { timeout: 30_000 });
    expect(document.querySelector('.tx-pages-wrapped[data-block-type="stat"]')).toBeNull();
    await waitFor(
      () =>
        expect(
          document
            .querySelector('.tx-pages-wrapped[data-block-type="form"]')
            ?.hasAttribute('data-refused')
        ).toBe(true),
      { timeout: 30_000 }
    );
    expect(hostForm('f')).toBeNull();
  }, 60_000);

  it('hands a renderBlock snippet a frozen copy, and wins over the component', async () => {
    const seen: PagesHostNode[] = [];
    const renderBlock = createRawSnippet((node: () => PagesHostNode) => ({
      render: () => '<p class="snippet-host"></p>',
      setup(element) {
        const value = node();
        seen.push(value);
        element.textContent = `snippet ${value.id}`;
        element.setAttribute('data-host-node', value.id);
      },
    }));
    const page = doc([FORM]);
    render(PageReader, {
      props: { document: page, renderBlock, blockHost: { component: HostBlockStub } },
    });
    await waitFor(() => expect(document.querySelector('.snippet-host')).not.toBeNull(), {
      timeout: 30_000,
    });
    expect(document.querySelector('.host-form')).toBeNull();
    const node = seen[0] as Extract<PagesHostNode, { type: 'block' }>;
    expect(node).toEqual(FORM);
    expect(Object.isFrozen(node)).toBe(true);
    expect(Object.isFrozen(node.props)).toBe(true);
    expect(Object.isFrozen((node.props.fields as readonly object[])[0])).toBe(true);
    expect(() => {
      (node.props as Record<string, unknown>).title = 'changed';
    }).toThrow();
    // The document itself is untouched and stays mutable for its owner.
    expect(Object.isFrozen(page.blocks[0])).toBe(false);
  }, 60_000);

  it('mounts with present and cleans up, and shows the notice when the host throws', async () => {
    const cleanup = vi.fn();
    const present = vi.fn(({ node, target }: { node: PagesHostNode; target: HTMLElement }) => {
      if (node.id === 'boom') throw new Error('host failed');
      const marker = document.createElement('output');
      marker.textContent = `mounted ${node.id}`;
      target.append(marker);
      return cleanup;
    });
    const view = render(PageReader, {
      props: {
        document: doc([FORM, { ...FORM, id: 'boom' }]),
        blockHost: { claim: () => 'host', present },
      },
    });
    await waitFor(() => expect(document.querySelector('output')?.textContent).toBe('mounted f'), {
      timeout: 30_000,
    });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-tx-pages-host] [data-refused]')).toHaveLength(1)
    );
    expect(document.querySelector('[data-tx-pages-host] [data-refused]')?.textContent).toContain(
      'This block was refused'
    );
    view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  }, 60_000);

  it('resolves claims defensively', () => {
    const node = readonlyNode(FORM as Extract<DocumentBlock, { type: 'block' }>);
    expect(blockPainter(null, null)).toBeNull();
    expect(blockPainter({ claim: () => 'host' }, undefined)).toBeNull();
    const painter = (host: PagesBlockHost) =>
      blockPainter({ component: HostBlockStub, ...host }, null);
    expect(blockClaim(null, node)).toBe('library');
    expect(blockClaim(painter({}), node)).toBe('fallback');
    expect(blockClaim(painter({ claim: () => 'host' }), node)).toBe('host');
    expect(blockClaim(painter({ claim: () => 'library' }), node)).toBe('library');
    expect(blockClaim(painter({ claim: () => 'nonsense' as never }), node)).toBe('fallback');
    expect(
      blockClaim(
        painter({
          claim: () => {
            throw new Error('x');
          },
        }),
        node
      )
    ).toBe('library');
  });

  it('keeps host blocks selectable, movable and deletable in the editor', async () => {
    let editor: PagesEditor | undefined;
    const onChange = vi.fn<(next: TexuliDocument) => void>();
    render(PageEditor, {
      props: {
        document: doc([para('p1', 'Intro'), FORM, para('p2', 'Outro')]),
        onChange,
        announce: () => {},
        motion: false,
        blockHost: { component: HostBlockStub },
        get editor() {
          return editor;
        },
        set editor(value: PagesEditor | undefined) {
          editor = value;
        },
      },
    });
    const ids = () => (editor as PagesEditor).doc.blocks.map((block) => block.id);
    const row = () => document.querySelector('[data-sortable-item="f"]') as HTMLElement;
    const handle = () => row().querySelector('.tx-pages-row__handle') as HTMLElement;
    await waitFor(() => expect(row().querySelector('[data-host-node="f"]')).not.toBeNull(), {
      timeout: 30_000,
    });
    // The host's own controls stay usable inside the row.
    const input = row().querySelector('input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    // Opaque row: the handle is its keyboard home.
    expect(handle().tabIndex).toBe(0);
    handle().focus();
    await tick();
    expect(row().hasAttribute('data-block-selected')).toBe(true);
    await fireEvent.keyDown(handle(), { key: 'ArrowDown', altKey: true });
    await tick();
    expect(ids()).toEqual(['p1', 'p2', 'f']);
    await waitFor(() => expect(document.activeElement).toBe(handle()));
    // The moved row still paints the host block.
    await waitFor(() => expect(row().querySelector('[data-host-node="f"]')).not.toBeNull());
    await fireEvent.keyDown(handle(), { key: 'ArrowUp', altKey: true });
    await tick();
    expect(ids()).toEqual(['p1', 'f', 'p2']);
    await fireEvent.keyDown(handle(), { key: 'Delete' });
    await tick();
    expect(ids()).toEqual(['p1', 'p2']);
    expect(document.querySelector('[data-host-node="f"]')).toBeNull();
    (editor as PagesEditor).undo();
    await tick();
    expect(ids()).toEqual(['p1', 'f', 'p2']);
    await waitFor(() => expect(row().querySelector('[data-host-node="f"]')).not.toBeNull());
    expect(onChange).toHaveBeenCalled();
  }, 60_000);
});

describe('host block renderer cost', () => {
  const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

  /** Static (non-type, non-dynamic) imports of a source file, resolved inside the package. */
  function staticImports(file: string): string[] {
    const source = readFileSync(file, 'utf8');
    const out: string[] = [];
    for (const match of source.matchAll(
      /^\s*(?:import|export)\s+(?!type\b)(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm
    )) {
      const specifier = match[1] as string;
      if (specifier.startsWith('.')) out.push(resolve(dirname(file), specifier));
    }
    return out;
  }

  function graph(entry: string): Set<string> {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file) || !/\.(ts|svelte)$/.test(file)) return;
      seen.add(file);
      for (const next of staticImports(file)) visit(next);
    };
    visit(entry);
    return seen;
  }

  it('keeps the host slot out of the static graph of the reader, the editor and the paged view', () => {
    for (const entry of ['reader/index.ts', 'editor/index.ts', 'paged/index.ts', 'index.ts']) {
      const files = [...graph(resolve(src, entry))].map((file) => file.slice(src.length + 1));
      expect(files, entry).toContain('shared/host-slot.ts');
      expect(files, entry).not.toContain('shared/HostSlot.svelte');
      expect(files, entry).not.toContain('shared/block-claim.ts');
      expect(files, entry).not.toContain('shared/HostBlockView.svelte');
    }
  });
});

/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import {
  DOCUMENT_HOST_PACKAGE,
  documentRoot,
  isDocumentTree,
} from '../src/document-host.ts';
import Player from '../src/Player.svelte';
import { createStreamSession } from '../src/stream/session.ts';
import { checkDocument, testDocumentHost } from './document-host.ts';
import { scenario } from './scenario.ts';

afterEach(cleanup);

/** A document blueprint (spec 0.7.0), fictional data only. */
function documentTree(blocks: unknown[] = [], extra: Record<string, unknown> = {}) {
  return {
    key: 'notes',
    id: 'document',
    props: {
      doc: {
        format: 'texuli-document',
        formatVersion: 1,
        meta: { title: 'Week 43 notes', locale: 'en' },
        blocks: [
          {
            id: 'p1',
            type: 'paragraph',
            content: [{ type: 'text', text: 'Shipped on time.', marks: [] }],
          },
          ...blocks,
        ],
      },
      ...extra,
    },
  };
}

const link = (href: string) => ({
  id: 'p2',
  type: 'paragraph',
  content: [{ type: 'text', text: 'Open', marks: [{ type: 'link', href }] }],
});

function paint(blueprint: unknown, props: Record<string, unknown> = {}) {
  const codes: string[] = [];
  const result = render(Player, {
    props: {
      blueprint,
      label: 'Document preview',
      onDiagnostics: (event: { diagnostics: readonly { code: string; severity: string }[] }) => {
        for (const d of event.diagnostics) if (d.severity === 'error') codes.push(d.code);
      },
      ...props,
    },
  });
  return { ...result, codes };
}

describe('the document host seam', () => {
  it('names the package that owns the reader and finds document roots', () => {
    expect(DOCUMENT_HOST_PACKAGE).toBe('@texuli/pages');
    expect(isDocumentTree(documentTree())).toBe(true);
    expect(isDocumentTree({ id: 'layout-doc' })).toBe(false);
    expect(isDocumentTree(null)).toBe(false);
    const root = { kind: 'component', id: 'document', props: {}, children: [] } as const;
    expect(documentRoot([root])).toBe(root);
    expect(documentRoot([root, root])).toBeNull();
    expect(documentRoot([{ ...root, id: 'layout-doc' }])).toBeNull();
  });

  it('hands a valid document to the host, which paints it, and cleans up on unmount', async () => {
    await scenario('document host presents a valid document', async () => {
      const { host, requests, stop } = testDocumentHost();
      const present = vi.spyOn(host, 'present');
      const { container, codes } = paint(documentTree([], { label: 'Notes', outline: false }), {
        documentHost: host,
      });
      await waitFor(() => expect(present).toHaveBeenCalledTimes(1));
      const request = requests[0];
      expect(request).toMatchObject({
        key: 'notes',
        tier: 'untrusted',
        docLabel: 'Notes',
        outline: false,
      });
      expect(request?.label).toBe('Document preview');
      expect(request?.active).toBe(true);
      const surface = container.querySelector('[data-tx-player-document-host-surface]');
      expect(request?.target).toBe(surface);
      expect(surface?.querySelector('[data-test-document]')?.textContent).toBe('Week 43 notes');
      expect(codes).toEqual([]);
      expect(container.querySelector('[data-tx-player-document-fallback]')).toBeNull();
      cleanup();
      expect(stop).toHaveBeenCalledTimes(1);
    });
  });

  it('presents again only for a new blueprint or tier', async () => {
    await scenario('document host re-presents on a new blueprint', async () => {
      const { host, requests, stop } = testDocumentHost();
      const { rerender } = paint(documentTree(), { documentHost: host });
      await waitFor(() => expect(requests).toHaveLength(1));
      await rerender({ label: 'Renamed', active: false });
      await tick();
      expect(requests).toHaveLength(1);
      expect(requests[0]?.label).toBe('Renamed');
      expect(requests[0]?.active).toBe(false);
      await rerender({ tier: 'developer' });
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(stop).toHaveBeenCalledTimes(1);
      expect(requests[1]?.tier).toBe('developer');
    });
  });

  it('refuses a document without a host: documents never pass on structure alone', async () => {
    await scenario('document without a host is refused', async () => {
      const { container, codes } = paint(documentTree());
      await waitFor(() => expect(codes).toContain('document-unchecked'));
      expect(container.querySelector('[data-status="invalid"]')).toBeTruthy();
      expect(container.querySelector('[data-tx-player-document-host-surface]')).toBeNull();
      expect(container.textContent).not.toContain('Shipped on time.');
    });
  });

  it('refuses hostile documents before the host ever sees them', async () => {
    await scenario('hostile documents are refused at the untrusted tier', async () => {
      const cases: [string, unknown, string][] = [
        ['a script link', documentTree([link('javascript:alert(1)')]), 'document-schema'],
        [
          'an unknown block',
          documentTree([{ id: 'x', type: 'script', text: 'alert(1)' }]),
          'document-schema',
        ],
        [
          'a component embed of app chrome',
          documentTree([
            { id: 'e', type: 'embed', kind: 'component', inline: { id: 'dialog', props: {} } },
          ]),
          'document-embed',
        ],
        [
          'a nested document',
          documentTree([
            { id: 'e', type: 'embed', kind: 'component', inline: { id: 'document', props: {} } },
          ]),
          'document-nested',
        ],
      ];
      for (const [label, blueprint, code] of cases) {
        const { host, requests } = testDocumentHost();
        const { container, codes, unmount } = paint(blueprint, { documentHost: host });
        await waitFor(() => expect(codes, label).toContain(code));
        expect(requests, label).toHaveLength(0);
        expect(container.querySelector('[data-tx-player-document-host-surface]'), label).toBeNull();
        unmount();
      }
    });
  });

  it('previews an invalid document without a host as a titled notice, never its blocks', async () => {
    await scenario('document fallback in preview', async () => {
      const { container } = paint(documentTree([link('javascript:alert(1)')]), {
        invalidPolicy: 'preview',
      });
      await waitFor(() =>
        expect(container.querySelector('[data-tx-player-document-fallback]')).toBeTruthy()
      );
      const fallback = container.querySelector('[data-tx-player-document-fallback]');
      expect(fallback?.textContent).toContain('Week 43 notes');
      expect(fallback?.textContent).toContain('opens in a document reader');
      expect(container.textContent).not.toContain('Shipped on time.');
      // The only link is the player's own skip link: the document's link never paints.
      expect(container.querySelector('a[href^="javascript"]')).toBeNull();
      expect(fallback?.querySelector('a')).toBeNull();
    });
  });

  it('streams a keyed document and refuses a repeated key while streaming', () => {
    const catalog = createPlayerCatalog();
    const session = createStreamSession({
      validate: { catalog, tier: 'untrusted', checkDocument },
      bindable: (id) => catalog.get(id)?.bindable,
    });
    const tree = {
      key: 'page',
      id: 'layout-doc',
      props: { title: 'Week 43' },
      children: [
        { key: 'a', id: 'blocks-text', props: { block: { type: 'text', markdown: 'One.' } } },
        { key: 'a', id: 'blocks-text', props: { block: { type: 'text', markdown: 'Two.' } } },
      ],
    };
    session.write(JSON.stringify(tree));
    const snapshot = session.snapshot();
    expect(snapshot.painted).toBe(2);
    expect(snapshot.issues).toContainEqual(
      expect.objectContaining({ path: '0.children.1', code: 'duplicate-key' })
    );
    // A keyed document streams as one node once its shell (with the whole doc) closes.
    const documents = createStreamSession({
      validate: { catalog, tier: 'untrusted', checkDocument },
      bindable: (id) => catalog.get(id)?.bindable,
    });
    const text = JSON.stringify(documentTree());
    documents.write(text.slice(0, -20));
    expect(documents.snapshot().painted).toBe(0);
    documents.write(text.slice(-20));
    expect(documents.snapshot().painted).toBe(1);
  });
});

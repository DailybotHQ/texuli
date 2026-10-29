import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { Player } from '@texuli/player';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDocumentDraft, createDocumentPlayerHost } from '../src/host/index.ts';

afterEach(cleanup);

/**
 * Agent documents paint through the player (spec 0.7.0, ADR-011): the
 * player validates a `document` blueprint with this host's check at its own
 * tier and hands a valid one to the host, which mounts the reader lazily.
 */
const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../spec/fixtures/golden/document-brief.json'), 'utf8')
) as { tree: { props: { doc: { blocks: unknown[] } } } };
const doc = golden.tree.props.doc;

describe('createDocumentPlayerHost', () => {
  it('checks documents at the given tier and keeps warnings from refusing', () => {
    expect(checkDocumentDraft(doc, 'untrusted')).toMatchObject({ ok: true });
    const relative = {
      ...doc,
      blocks: [
        ...doc.blocks,
        {
          id: 'rel',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Docs', marks: [{ type: 'link', href: '/docs' }] }],
        },
      ],
    };
    expect(checkDocumentDraft(relative, 'untrusted').ok).toBe(false);
    expect(checkDocumentDraft(relative, 'developer').ok).toBe(true);
    const refused = checkDocumentDraft({ ...doc, format: 'html' }, 'untrusted');
    expect(refused.ok).toBe(false);
    expect(refused.issues[0]).toMatchObject({ severity: 'error', path: expect.any(String) });
  });

  it('paints an agent document with the reader inside the player, and unmounts it', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: golden,
        label: 'Agent document',
        documentHost: createDocumentPlayerHost(),
      },
    });
    const article = await screen.findByRole(
      'article',
      { name: 'Launch brief' },
      { timeout: 10_000 }
    );
    expect(
      container.querySelector('[data-tx-player-document-host-surface]')?.contains(article)
    ).toBe(true);
    // headingOffset 1: the document's level-1 heading sits under the player's h2 label.
    expect(screen.getByRole('heading', { name: 'Launch brief', level: 2 })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'plan' }).getAttribute('href')).toBe(
      'https://example.com/plan'
    );
    await waitFor(() => expect(screen.getByText('The beta ends on Friday.')).toBeTruthy());
    cleanup();
    expect(document.querySelector('.tx-pages-reader')).toBeNull();
  });

  it('paints nothing for a document the check refuses', async () => {
    const hostile = {
      ...golden,
      tree: {
        ...golden.tree,
        props: {
          doc: {
            ...doc,
            blocks: [
              {
                id: 'x',
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Open',
                    marks: [{ type: 'link', href: 'javascript:alert(1)' }],
                  },
                ],
              },
            ],
          },
        },
      },
    };
    const { container } = render(Player, {
      props: {
        blueprint: hostile,
        label: 'Agent document',
        documentHost: createDocumentPlayerHost(),
      },
    });
    await waitFor(() => expect(container.querySelector('[data-status="invalid"]')).toBeTruthy());
    expect(container.querySelector('.tx-pages-reader')).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    // `present` alone refuses it too, whatever the caller.
    const host = createDocumentPlayerHost();
    const target = document.createElement('div');
    const result = host.present({
      doc: hostile.tree.props.doc,
      outline: true,
      tier: 'untrusted',
      label: 'x',
      active: true,
      target,
    });
    expect(result).toBeUndefined();
    expect(target.childElementCount).toBe(0);
  });
});

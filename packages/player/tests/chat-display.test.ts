import { render, screen } from '@testing-library/svelte';
import { validateCatalogManifests } from '@texuli/catalog/manifest';
import { describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { CHAT_DISPLAY_MANIFESTS } from '../src/chat-manifests.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';

const stub = async () => import('./ChatStub.svelte').then((m) => m.default);

function transcript(message: Record<string, unknown>, extra: unknown[] = []) {
  return {
    id: 'layout-doc',
    props: { title: 'Stand-up notes' },
    children: [
      {
        id: 'chat-thread',
        props: { label: 'Stand-up thread' },
        children: [{ id: 'chat-message', props: message, children: extra }, ...[]],
      },
    ],
  };
}

const agentReply = {
  author: 'Fictional Agent',
  role: 'agent',
  at: '2026-10-24T09:00:00Z',
  text: 'Two items are **blocked**.',
};

describe('G10 chat display ids', () => {
  it('ships valid manifests that agents may emit', () => {
    expect(validateCatalogManifests(CHAT_DISPLAY_MANIFESTS)).toMatchObject({ valid: true });
    const catalog = createPlayerCatalog();
    for (const id of ['chat-thread', 'chat-message']) {
      expect(catalog.get(id)).toBeTruthy();
      expect(catalog.allows?.(id, 'untrusted')).toBe(true);
    }
  });

  it('validates a chat transcript with block children under the untrusted tier', () => {
    const onDiagnostics = vi.fn();
    render(Player, {
      props: {
        blueprint: transcript(agentReply, [
          { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Details.' } } },
        ]),
        loaders: {},
        onDiagnostics,
      },
    });
    const [event] = onDiagnostics.mock.calls[0] ?? [];
    expect(event.receipt.ok).toBe(true);
    expect(event.diagnostics.filter((d: { severity: string }) => d.severity === 'error')).toEqual(
      []
    );
  });

  it.each([
    ['an unknown role', { ...agentReply, role: 'admin' }],
    ['a missing author', { role: 'agent', text: 'Hi' }],
    ['HTML text', { ...agentReply, text: '<img src=x onerror=alert(1)>' }],
  ])('refuses %s', (_name, message) => {
    render(Player, { props: { blueprint: transcript(message), loaders: {} } });
    expect(screen.getByRole('alert').textContent).toContain('could not be validated');
  });

  it('shows no-painter placeholders until the host adds chat loaders', async () => {
    render(Player, { props: { blueprint: transcript(agentReply) } });
    expect(await screen.findByText(/No painter for “chat-thread”/)).toBeTruthy();
  });

  it('paints the thread, message and block body through host loaders', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: transcript(agentReply, [
          { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Body block.' } } },
        ]),
        loaders: { ...PLAYER_LOADERS, 'chat-thread': stub, 'chat-message': stub },
      },
    });
    expect(await screen.findByText('Fictional Agent')).toBeTruthy();
    expect(await screen.findByText('Body block.', {}, { timeout: 5000 })).toBeTruthy();
    const thread = container.querySelector('[aria-label="Stand-up thread"]');
    expect(thread?.querySelector('[data-role="agent"]')).toBeTruthy();
  });
});

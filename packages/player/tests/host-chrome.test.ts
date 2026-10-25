import { render, screen } from '@testing-library/svelte';
import type { RenderCatalog } from '@texuli/catalog/render/renderer';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { withoutHostChrome, withoutHostChromeLoaders } from '../src/host-chrome.ts';
import Player from '../src/Player.svelte';

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

/** A host catalog that (wrongly) lists a composer as agent-emittable content. */
function catalogWithComposer(): RenderCatalog {
  const base = createPlayerCatalog();
  const composer = {
    id: 'chat-composer',
    label: 'Chat composer',
    props: [],
    agentEmittable: true,
    emit: ['developer', 'untrusted'] as const,
  };
  return {
    get: (id) => (id === 'chat-composer' ? composer : base.get(id)),
    allows: (id, tier) => id === 'chat-composer' || (base.allows?.(id, tier) ?? false),
  };
}

const blueprint = {
  id: 'layout-page',
  props: { title: 'Thread artifact' },
  children: [{ id: 'chat-composer', props: {} }],
};

describe('composer host-chrome contract', () => {
  it('denies host-chrome ids at every tier, even when the host catalog allows them', () => {
    const catalog = withoutHostChrome(catalogWithComposer());
    expect(catalog.allows?.('chat-composer', 'developer')).toBe(false);
    expect(catalog.allows?.('chat-composer', 'untrusted')).toBe(false);
    expect(catalog.allows?.('layout-page', 'untrusted')).toBe(true);
    const loaders = withoutHostChromeLoaders({ 'chat-composer': layoutLoader, x: layoutLoader });
    expect(Object.keys(loaders)).toEqual(['x']);
  });

  it('refuses a blueprint that tries to paint a composer, and never loads its painter', () => {
    const composerLoader = vi.fn(layoutLoader);
    render(Player, {
      props: {
        blueprint,
        catalog: catalogWithComposer(),
        tier: 'developer',
        loaders: { 'layout-page': layoutLoader, 'chat-composer': composerLoader },
      },
    });
    expect(screen.getByRole('alert').textContent).toContain('could not be validated');
    expect(composerLoader).not.toHaveBeenCalled();
  });

  it('shows the refused composer as a placeholder in a preview', async () => {
    const composerLoader = vi.fn(layoutLoader);
    const { container } = render(Player, {
      props: {
        blueprint,
        catalog: catalogWithComposer(),
        invalidPolicy: 'preview',
        loaders: { 'layout-page': layoutLoader, 'chat-composer': composerLoader },
      },
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Thread artifact' })).toBeTruthy();
    expect(
      container.querySelector('[data-tx-player-node="chat-composer"]')?.getAttribute('data-reason')
    ).toBe('tier-denied');
    expect(composerLoader).not.toHaveBeenCalled();
  });

  it('paints the host composer snippet outside the validated surface', async () => {
    const composer = createRawSnippet(() => ({
      render: () =>
        '<form data-testid="host-composer"><label>Reply<textarea></textarea></label></form>',
    }));
    const { container } = render(Player, {
      props: {
        blueprint: { id: 'layout-page', props: { title: 'Artifact' } },
        loaders: { 'layout-page': layoutLoader },
        composer,
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Artifact' });
    const chrome = container.querySelector('[data-tx-player-host-chrome="composer"]');
    const surface = container.querySelector('[data-tx-player-surface]');
    expect(chrome?.contains(screen.getByTestId('host-composer'))).toBe(true);
    expect(surface?.contains(chrome ?? null)).toBe(false);
  });
});

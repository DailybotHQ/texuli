import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';

afterEach(cleanup);

const blueprint = {
  id: 'layout-doc',
  props: { title: 'Fictional delivery report' },
  children: [
    {
      id: 'blocks-text',
      props: { block: { type: 'heading', level: 2, text: 'Weekly summary' } },
    },
    {
      id: 'blocks-text',
      props: { block: { type: 'text', markdown: 'All sample work is on track.' } },
    },
  ],
};

describe('Player', () => {
  it('validates and paints a content blueprint inside visible frame chrome', async () => {
    render(Player, { props: { blueprint } });

    expect(screen.getByRole('region', { name: 'Blueprint preview' })).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fictional delivery report' })
    ).toBeTruthy();
    // A cold import of the text family can take about a second in happy-dom.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Weekly summary' }, { timeout: 5000 })
    ).toBeTruthy();
    expect(screen.getByText('All sample work is on track.')).toBeTruthy();
  });

  it('defaults to untrusted validation and refuses invalid trees without painting them', () => {
    render(Player, {
      props: {
        blueprint: {
          id: 'layout-doc',
          props: { title: 'Must not paint', href: 'javascript:alert(1)' },
        },
      },
    });

    expect(screen.getByRole('alert').textContent).toContain('could not be validated');
    expect(screen.queryByRole('heading', { name: 'Must not paint' })).toBeNull();
  });

  it('keeps unsupported valid catalog ids as visible no-loader placeholders', async () => {
    const catalog = createPlayerCatalog();
    render(Player, {
      props: {
        catalog,
        blueprint: {
          id: 'layout-page',
          props: { title: 'Page' },
          children: [
            { id: 'media-image', props: { src: 'https://images.example/ok.png', alt: 'Sample' } },
          ],
        },
        loaders: {
          'layout-page': async () =>
            import('../src/layouts/ContentLayout.svelte').then((m) => m.default),
        },
      },
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Page' })).toBeTruthy();
    expect(await screen.findByText(/No painter for “media-image”/)).toBeTruthy();
  });

  it('contains a component paint exception to its own node', async () => {
    render(Player, {
      props: {
        blueprint,
        loaders: {
          ...PLAYER_LOADERS,
          'blocks-text': async () => import('./ThrowingComponent.svelte').then((m) => m.default),
        },
      },
    });

    expect(await screen.findAllByText('“blocks-text” could not be shown')).toHaveLength(2);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Fictional delivery report' })
    ).toBeTruthy();
  });
});

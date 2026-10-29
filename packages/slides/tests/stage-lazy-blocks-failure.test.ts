/**
 * When the stage's lazy chunks fail to load (G46), it refuses: the built-in
 * block check refuses every free-slide block, and a deck in an earlier shape
 * without `migrateDeck` is not read. The error state shows, never raw data.
 */
import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DeckStage from '../src/stage/DeckStage.svelte';
import HostFreeSlide from './fixtures/HostFreeSlide.svelte';
import { scenario } from './scenario.ts';

vi.mock('../src/stage/builtin.ts', () => {
  throw new Error('offline');
});
vi.mock('../src/stage/migrate-chunk.ts', () => {
  throw new Error('offline');
});

describe('lazy chunk failures (G46)', () => {
  it('refuses the deck instead of painting unchecked content', async () => {
    await scenario('a failed block check refuses every block', async () => {
      const onError = vi.fn();
      render(DeckStage, {
        props: {
          deck: {
            formatVersion: 2,
            meta: { title: 'Offline' },
            slides: [{ id: 'one', layout: 'free', blocks: [{ type: 'host-card', title: 'Raw' }] }],
          },
          loadTheme: null,
          defaultRenderers: false,
          renderers: { free: () => HostFreeSlide },
          onError,
        },
      });
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe('This deck could not be shown.')
      );
      expect(document.querySelector('[data-host-free]')).toBeNull();
      expect(
        onError.mock.calls[0]?.[0].map((issue: { message: string }) => issue.message)
      ).toContain('The block check could not be loaded.');
    });

    await scenario('a failed migration refuses a deck in an earlier shape', async () => {
      const onError = vi.fn();
      render(DeckStage, {
        props: {
          deck: { meta: { title: 'Legacy' }, slides: [{ id: 'one', blocks: [] }] },
          loadTheme: null,
          defaultRenderers: false,
          renderers: { validateBlock: () => undefined, free: () => HostFreeSlide },
          onError,
        },
      });
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toBe('This deck could not be shown.')
      );
      expect(onError.mock.calls[0]?.[0].map((issue: { message: string }) => issue.message)).toEqual(
        ['The deck could not be migrated.']
      );
    });
  });
});

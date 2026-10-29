/**
 * `@texuli/slides/stage-core` (G72): `DeckStageCore` paints with the host's
 * renderers alone and never loads the default tables, even with
 * `defaultRenderers` left on; `DeckStage` is the same core with the
 * built-in defaults source. The bundle side is in `bundle-graph.test.ts`.
 */
import { cleanup, render, waitFor } from '@testing-library/svelte';
import type { DeckSlide } from '@texuli/deck/model';
import { afterEach, describe, expect, it } from 'vitest';
import { DeckStageCore, loadDeckMigration, loadedDeckMigration } from '../src/stage/core.ts';
import {
  DECK_DEFAULT_RENDERERS_SOURCE,
  loadedDefaultDeckRenderers,
} from '../src/stage/defaults.ts';
import HostFreeSlide from './fixtures/HostFreeSlide.svelte';

const free = (id: string, blocks: unknown[]) =>
  ({ id, layout: 'free', blocks }) as unknown as DeckSlide;

const deck = {
  formatVersion: 2,
  meta: { title: 'Host only' },
  slides: [
    free('one', [{ type: 'host-card', title: 'Hello from the host' }]),
    { id: 'q', layout: 'quote', props: { quote: 'Small pieces.' } },
  ],
};

afterEach(cleanup);

describe('DeckStageCore', () => {
  it('paints host renderers and leaves layouts to placeholders without loading the defaults', async () => {
    render(DeckStageCore, {
      props: {
        deck,
        loadTheme: null,
        renderers: { validateBlock: () => undefined, free: () => HostFreeSlide },
      },
    });
    await waitFor(() =>
      expect(document.querySelector('[data-host-free]')?.textContent?.trim()).toBe(
        'Hello from the host'
      )
    );
    expect(document.querySelector('.tx-deck-stage')?.getAttribute('aria-busy')).toBeNull();
    expect(
      document.querySelector('[data-slide-id="q"] [data-tx-deck-placeholder="quote"]')
    ).toBeTruthy();
    // Nothing asked for the default tables: a started import would have landed by now.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(loadedDefaultDeckRenderers()).toBeUndefined();
    expect(Object.isFrozen(DECK_DEFAULT_RENDERERS_SOURCE)).toBe(true);
  });

  it('exports loadDeckMigration so a host can preload migrateDeck (G73)', async () => {
    const migrate = await loadDeckMigration();
    expect(typeof migrate).toBe('function');
    expect(loadedDeckMigration()).toBe(migrate);
  });
});

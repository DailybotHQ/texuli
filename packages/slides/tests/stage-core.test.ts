/**
 * `@texuli/slides/stage-core` (G72): `DeckStageCore` paints with the host's
 * renderers alone and never loads the default tables, even with
 * `defaultRenderers` left on; `DeckStage` is the same core with the
 * built-in defaults source. The bundle side is in `bundle-graph.test.ts`.
 */
import { cleanup, render, waitFor } from '@testing-library/svelte';
import type { DeckSlide } from '@texuli/deck/model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeckPrintPaint } from '../src/export/print-paint.ts';
import {
  DeckStageCore,
  loadDeckLibraryTheme,
  loadDeckMigration,
  loadedDeckMigration,
} from '../src/stage/core.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
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

  it('reaches catalog themes only through an injected loader; DeckStage keeps the library default (G127)', async () => {
    const themed = { ...deck, style: { theme: 'violet' } };
    const renderers = { validateBlock: () => undefined, free: () => HostFreeSlide };
    const status = () =>
      document.querySelector('.tx-deck-stage')?.getAttribute('data-theme-status');

    // The core has no default loader: without one, catalog themes are the host's CSS.
    render(DeckStageCore, { props: { deck: themed, renderers } });
    await waitFor(() => expect(document.querySelector('[data-host-free]')).toBeTruthy());
    expect(status()).toBe('host');
    cleanup();

    // A host loader (here the library one, opted into by name) is what paints the theme.
    const loadTheme = vi.fn(loadDeckLibraryTheme);
    render(DeckStageCore, { props: { deck: themed, renderers, loadTheme } });
    await waitFor(() => expect(status()).toBe('applied'), { timeout: 10_000 });
    expect(loadTheme).toHaveBeenCalledWith('violet');
    cleanup();

    // DeckStage still loads the library theme by default.
    render(DeckStage, { props: { deck: themed, renderers, defaultRenderers: false } });
    await waitFor(() => expect(status()).toBe('applied'), { timeout: 10_000 });

    // The print painter behind DeckPrintViewCore has no default either (DeckPrintView passes it).
    const slide = themed.slides[0] as DeckSlide;
    const bare = await createDeckPrintPaint(themed as never, { renderers });
    expect(bare.themeVars(slide)).toEqual({});
    const library = await createDeckPrintPaint(themed as never, {
      renderers,
      loadTheme: loadDeckLibraryTheme,
    });
    expect(Object.keys(library.themeVars(slide)).length).toBeGreaterThan(0);
  }, 30_000);
});

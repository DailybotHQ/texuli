/**
 * The stage's default renderer tables and a host's block check load on first
 * use (G24, G25). This file never preloads them: the module cache starts
 * empty, so the scenarios run in order (host-only first, then the first load).
 */
import { render, screen, waitFor } from '@testing-library/svelte';
import type { DeckSlide } from '@texuli/deck/model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeckPrintPaint } from '../src/export/print-paint.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { DEFAULT_DECK_RENDERERS } from '../src/stage/default-renderers.ts';
import { loadedDefaultDeckRenderers } from '../src/stage/defaults.ts';
import { prepareDeck } from '../src/stage/prepare.ts';
import {
  type DeckRenderers,
  deckValidationHooks,
  deckValidatorsReady,
  loadDeckValidators,
} from '../src/stage/renderers.ts';
import HostFreeSlide from './fixtures/HostFreeSlide.svelte';
import { scenario } from './scenario.ts';

const free = (id: string, blocks: unknown[]) =>
  ({ id, layout: 'free', blocks }) as unknown as DeckSlide;

const layoutDeck = {
  formatVersion: 2,
  meta: { title: 'Lazy defaults' },
  slides: [
    { id: 'q', layout: 'quote', props: { quote: 'Small pieces.' } },
    free('two', [{ type: 'text', markdown: 'Two' }]),
  ],
};

const hostDeck = {
  formatVersion: 2,
  meta: { title: 'Host blocks' },
  slides: [free('one', [{ type: 'host-card', title: 'Hello from the host' }])],
};

const quote = () => document.querySelector('[data-slide-id="q"]');
const stageRoot = () => document.querySelector<HTMLElement>('.tx-deck-stage');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lazy default renderers and block checks', () => {
  it('loads the default tables only when they are on, and paints once they arrive', async () => {
    await scenario('defaultRenderers={false} never loads them', async () => {
      render(DeckStage, {
        props: { deck: layoutDeck, loadTheme: null, defaultRenderers: false },
      });
      // No table brings a block check: the stage waits for its built-in one (G46), not the tables.
      await waitFor(() => expect(stageRoot()?.getAttribute('aria-busy')).toBeNull());
      expect(quote()?.querySelector('[data-tx-deck-placeholder="quote"]')).toBeTruthy();
      const paint = await createDeckPrintPaint(layoutDeck as never, {
        defaultRenderers: false,
        loadTheme: null,
      });
      expect(paint.paint.renderers).toEqual([]);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(loadedDefaultDeckRenderers()).toBeUndefined();
    });

    await scenario('the first stage shows a busy loading status, then the slides', async () => {
      render(DeckStage, { props: { deck: layoutDeck, loadTheme: null } });
      expect(stageRoot()?.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByRole('status').textContent).toBe('Loading slide content…');
      expect(quote()).toBeNull();
      await waitFor(() => expect(quote()).toBeTruthy());
      expect(stageRoot()?.getAttribute('aria-busy')).toBeNull();
      expect(quote()?.querySelector('[data-tx-deck-placeholder]')).toBeNull();
      expect(loadedDefaultDeckRenderers()).toBe(DEFAULT_DECK_RENDERERS);
    });

    await scenario('later stages and the print view read the loaded tables at once', async () => {
      render(DeckStage, { props: { deck: layoutDeck, loadTheme: null } });
      expect(stageRoot()?.getAttribute('aria-busy')).toBeNull();
      expect(quote()?.querySelector('[data-tx-deck-placeholder]')).toBeNull();
      const host: DeckRenderers = { custom: () => null };
      const paint = await createDeckPrintPaint(layoutDeck as never, {
        renderers: host,
        loadTheme: null,
      });
      expect(paint.paint.renderers).toEqual([host, ...DEFAULT_DECK_RENDERERS]);
    });
  });

  it('resolves a lazy host validateBlock before validating, and refuses blocks without it', async () => {
    await scenario('deckValidationHooks refuses blocks until the check has loaded', async () => {
      const check = vi.fn(() => undefined);
      const table: DeckRenderers = { loadValidateBlock: async () => ({ validateBlock: check }) };
      expect(deckValidatorsReady([table])).toBe(false);
      const early = prepareDeck(hostDeck, deckValidationHooks([table]));
      expect(early.ok).toBe(false);
      expect(early.issues.map((issue) => issue.message)).toContain(
        'The block check could not be loaded.'
      );
      await loadDeckValidators([table]);
      expect(deckValidatorsReady([table])).toBe(true);
      expect(prepareDeck(hostDeck, deckValidationHooks([table])).ok).toBe(true);
      expect(check).toHaveBeenCalledTimes(1);
      // A default export or the bare function resolve too; a sync validateBlock wins.
      for (const loaded of [{ default: check }, check]) {
        const lazy: DeckRenderers = { loadValidateBlock: async () => loaded };
        await loadDeckValidators([lazy]);
        expect(prepareDeck(hostDeck, deckValidationHooks([lazy])).ok).toBe(true);
      }
      const both: DeckRenderers = {
        validateBlock: () => undefined,
        loadValidateBlock: () => new Promise(() => {}),
      };
      expect(deckValidatorsReady([both])).toBe(true);
      expect(prepareDeck(hostDeck, deckValidationHooks([both])).ok).toBe(true);
    });

    await scenario('the stage waits for the check, then paints the host blocks', async () => {
      let release: (value: { validateBlock: () => undefined }) => void = () => {};
      const loadValidateBlock = vi.fn(
        () =>
          new Promise<{ validateBlock: () => undefined }>((resolve) => {
            release = resolve;
          })
      );
      render(DeckStage, {
        props: {
          deck: hostDeck,
          loadTheme: null,
          renderers: { loadValidateBlock, free: () => HostFreeSlide },
        },
      });
      await waitFor(() => expect(loadValidateBlock).toHaveBeenCalledTimes(1));
      expect(stageRoot()?.getAttribute('aria-busy')).toBe('true');
      expect(document.querySelector('[data-host-free]')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
      release({ validateBlock: () => undefined });
      await waitFor(() =>
        expect(document.querySelector('[data-host-free]')?.textContent?.trim()).toBe(
          'Hello from the host'
        )
      );
      expect(screen.queryByRole('alert')).toBeNull();
    });

    await scenario(
      'a failed import refuses every block: the error state, never raw data',
      async () => {
        const onError = vi.fn();
        render(DeckStage, {
          props: {
            deck: hostDeck,
            loadTheme: null,
            onError,
            renderers: {
              loadValidateBlock: () => Promise.reject(new Error('offline')),
              free: () => HostFreeSlide,
            },
          },
        });
        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('This deck could not be shown.')
        );
        expect(document.querySelector('[data-host-free]')).toBeNull();
        expect(onError).toHaveBeenCalledTimes(1);
      }
    );
  });
});

/**
 * The stage's built-in block support and `migrateDeck` load on first use
 * (G46): a host that brings its own block check and free-slide renderer, with
 * a v2 deck, never loads them; a stage that falls back to them waits for
 * them before validating, so nothing is accepted unchecked. This file never
 * preloads anything: the module cache starts empty, so the scenarios run in
 * order (nothing loaded first, then each first load).
 */
import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { loadedBuiltinDeckBlocks } from '../src/stage/builtin-loader.ts';
import DeckStage from '../src/stage/DeckStage.svelte';
import { loadedDefaultDeckRenderers } from '../src/stage/defaults.ts';
import { loadedDeckMigration } from '../src/stage/migration.ts';
import HostFreeSlide from './fixtures/HostFreeSlide.svelte';
import { scenario } from './scenario.ts';

const v2Deck = {
  formatVersion: 2,
  meta: { title: 'Host blocks' },
  slides: [{ id: 'one', layout: 'free', blocks: [{ type: 'host-card', title: 'From the host' }] }],
};

/** The same deck in the Texuli v1 shape (`meta` + `slides[].blocks`, no `formatVersion`). */
const v1Deck = {
  meta: { title: 'Legacy host blocks' },
  slides: [{ id: 'one', blocks: [{ type: 'host-card', title: 'From a v1 deck' }] }],
};

const builtinDeck = (blocks: unknown[]) => ({
  formatVersion: 2,
  meta: { title: 'Built-in blocks' },
  slides: [{ id: 'one', layout: 'free', blocks }],
});

const stageRoot = () => document.querySelector<HTMLElement>('.tx-deck-stage');
const hostFree = () => document.querySelector('[data-host-free]')?.textContent?.trim();
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('lazy built-in block support and deck migration (G46)', () => {
  it('loads them only when the stage falls back to them', async () => {
    await scenario('a host check and free renderer with a v2 deck load neither', async () => {
      const validateBlock = vi.fn(() => undefined);
      render(DeckStage, {
        props: {
          deck: v2Deck,
          loadTheme: null,
          defaultRenderers: false,
          renderers: { validateBlock, free: () => HostFreeSlide },
        },
      });
      // Painted on the first render: nothing to wait for.
      expect(stageRoot()?.getAttribute('aria-busy')).toBeNull();
      expect(hostFree()).toBe('From the host');
      expect(validateBlock).toHaveBeenCalledTimes(1);
      await settle();
      expect(loadedBuiltinDeckBlocks()).toBeUndefined();
      expect(loadedDeckMigration()).toBeUndefined();
      expect(loadedDefaultDeckRenderers()).toBeUndefined();
    });

    await scenario('an earlier deck shape waits for migrateDeck, then paints', async () => {
      render(DeckStage, {
        props: {
          deck: v1Deck,
          loadTheme: null,
          defaultRenderers: false,
          renderers: { validateBlock: () => undefined, free: () => HostFreeSlide },
        },
      });
      expect(stageRoot()?.getAttribute('aria-busy')).toBe('true');
      expect(hostFree()).toBeUndefined();
      await waitFor(() => expect(hostFree()).toBe('From a v1 deck'));
      expect(loadedDeckMigration()).toBeTypeOf('function');
      expect(loadedBuiltinDeckBlocks()).toBeUndefined();
    });

    await scenario('without a host check the stage waits for the default one', async () => {
      const onError = vi.fn();
      // `host-card` is not a @texuli/blocks block: the default check refuses it.
      render(DeckStage, {
        props: {
          deck: builtinDeck([{ type: 'host-card', title: 'Unchecked' }]),
          loadTheme: null,
          defaultRenderers: false,
          renderers: { free: () => HostFreeSlide },
          onError,
        },
      });
      expect(stageRoot()?.getAttribute('aria-busy')).toBe('true');
      expect(hostFree()).toBeUndefined();
      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(stageRoot()?.getAttribute('data-tx-deck-invalid')).toBe('true');
      expect(document.body.textContent).not.toContain('Unchecked');
      expect(loadedBuiltinDeckBlocks()?.ok).toBe(true);
    });

    await scenario('once loaded, the built-in renderer paints at once', async () => {
      render(DeckStage, {
        props: {
          deck: builtinDeck([{ type: 'divider' }, { type: 'text', markdown: 'Built in' }]),
          loadTheme: null,
          defaultRenderers: false,
        },
      });
      expect(stageRoot()?.getAttribute('aria-busy')).toBeNull();
      // The built-in free renderer itself is ready (its block families still load lazily).
      expect(document.querySelector('[data-tx-deck-item="1"]')).toBeTruthy();
      expect(loadedDefaultDeckRenderers()).toBeUndefined();
    });
  });
});

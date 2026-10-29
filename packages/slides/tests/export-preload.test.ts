/**
 * G81: `preloadDeckPrintView()` warms the print view's lazy body, its slide
 * painter and the default renderer tables, so a view mounted afterwards
 * renders its pages on the first render. This file never mounts a view
 * before preloading: the module cache starts empty.
 */
import { render } from '@testing-library/svelte';
import { parseDeck } from '@texuli/deck/model';
import { describe, expect, it } from 'vitest';
import DeckPrintView from '../src/export/DeckPrintView.svelte';
import { preloadDeckPrintView } from '../src/export/index.ts';
import { loadedDeckPrintBody } from '../src/export/print-preload.ts';
import { loadedDefaultDeckRenderers } from '../src/stage/defaults.ts';
import { scenario } from './scenario.ts';

const parsed = parseDeck({
  formatVersion: 2,
  meta: { title: 'Preloaded print' },
  slides: [{ id: 'cover', layout: 'title-hero', props: { title: 'On paper' } }],
});
if (!parsed.ok || !parsed.deck) throw new Error('fixture deck is invalid');
const deck = parsed.deck;
const view = () => document.querySelector('.tx-deck-print-view');

describe('preloadDeckPrintView (G81)', () => {
  it('warms the body and tables so the view renders its pages on the first render', async () => {
    await scenario('without a preload the first render is empty', () => {
      // The body is still loading: nothing printable yet.
      expect(loadedDeckPrintBody()).toBeUndefined();
      render(DeckPrintView, { props: { deck, defaultRenderers: false, loadTheme: null } });
      expect(view()).toBeNull();
    });

    await scenario('after the preload the pages are there at once', async () => {
      await preloadDeckPrintView({ defaultRenderers: false });
      expect(loadedDeckPrintBody()).toBeTruthy();
      // `defaultRenderers: false` leaves the tables alone.
      expect(loadedDefaultDeckRenderers()).toBeUndefined();
      render(DeckPrintView, { props: { deck, defaultRenderers: false, loadTheme: null } });
      expect(view()).toBeTruthy();
      expect(view()?.querySelectorAll('.tx-deck-print-view__slide')).toHaveLength(1);
    });

    await scenario(
      'the default preload warms the default tables too, and repeats safely',
      async () => {
        await preloadDeckPrintView();
        await preloadDeckPrintView();
        expect(loadedDefaultDeckRenderers()?.length).toBeGreaterThan(0);
      }
    );
  });
});

/**
 * Several stages on one page keep distinct landmark names, also while they
 * load (SSR markup and the lazy defaults): the name comes from the deck's own
 * title, and a loading stage whose input names no title is not a named
 * landmark at all (axe `landmark-unique` on texuli.com /slides-page/). This
 * file never preloads the default tables, so the stages start loading.
 */
import { render, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DeckStage from '../src/stage/DeckStage.svelte';
import { scenario } from './scenario.ts';

const deck = (title: string | undefined) => ({
  formatVersion: 2,
  meta: title === undefined ? {} : { title },
  slides: [{ id: 'one', layout: 'quote', props: { quote: 'Small pieces.' } }],
});

const stages = () => [...document.querySelectorAll<HTMLElement>('.tx-deck-stage')];
const names = () => stages().map((stage) => stage.getAttribute('aria-label'));

describe('the stage landmark name', () => {
  it('stays unique per deck while loading and after paint', async () => {
    await scenario('two loading stages, one untitled', async () => {
      for (const title of ['Alpha', 'Beta', undefined]) {
        render(DeckStage, { props: { deck: deck(title), loadTheme: null, syncHash: false } });
      }
      expect(stages().map((stage) => stage.getAttribute('aria-busy'))).toEqual([
        'true',
        'true',
        'true',
      ]);
      expect(names()).toEqual(['Presentation: Alpha', 'Presentation: Beta', null]);
      // The loading status is a status, not a second landmark.
      for (const stage of stages()) {
        expect(stage.querySelectorAll('[role="region"], section[aria-label]')).toHaveLength(0);
        expect(stage.querySelector('[role="status"]')).toBeTruthy();
      }
    });

    await scenario('painted stages are named by their validated titles', async () => {
      for (const title of ['Alpha', 'Beta']) {
        render(DeckStage, { props: { deck: deck(title), loadTheme: null, syncHash: false } });
      }
      // The default tables load lazily; on a loaded host that can take more than a second.
      await waitFor(
        () => expect(stages().every((stage) => !stage.hasAttribute('aria-busy'))).toBe(true),
        { timeout: 10_000 }
      );
      expect(names()).toEqual(['Presentation: Alpha', 'Presentation: Beta']);
    });

    await scenario('hostile input reads as untitled', async () => {
      const hostile = {
        formatVersion: 2,
        get meta(): never {
          throw new Error('hostile');
        },
      };
      render(DeckStage, {
        props: { deck: hostile, loadTheme: null, syncHash: false, defaultRenderers: false },
      });
      await waitFor(() => expect(stages()[0]?.getAttribute('data-tx-deck-invalid')).toBe('true'), {
        timeout: 10_000,
      });
      expect(names()).toEqual([null]);
    });
  });
});

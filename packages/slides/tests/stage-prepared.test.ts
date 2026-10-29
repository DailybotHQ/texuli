/**
 * G83: a prepared deck (an `ok` result of `prepareDeck` / `prepareDeckV2`)
 * paints on the stage's first render at the `developer` tier, without
 * loading the migration or the built-in block check; a look-alike object
 * (agent output, a JSON copy, a structured clone) and the `untrusted` tier
 * are validated like any input.
 */
import { render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeckStageCore from '../src/stage/DeckStageCore.svelte';
import { isPreparedDeck, prepareDeck, prepareDeckV2 } from '../src/stage/prepare.ts';
import HostFreeSlide from './fixtures/HostFreeSlide.svelte';
import { scenario } from './scenario.ts';

const loaders = vi.hoisted(() => ({ migration: 0, builtin: 0 }));

vi.mock('../src/stage/migration.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/stage/migration.ts')>();
  return {
    ...original,
    loadDeckMigration: () => {
      loaders.migration += 1;
      return original.loadDeckMigration();
    },
  };
});

vi.mock('../src/stage/builtin-loader.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/stage/builtin-loader.ts')>();
  return {
    ...original,
    loadBuiltinDeckBlocks: () => {
      loaders.builtin += 1;
      return original.loadBuiltinDeckBlocks();
    },
  };
});

const hostDeck = {
  formatVersion: 2,
  meta: { title: 'Prepared harbor' },
  slides: [
    { id: 'one', layout: 'free', blocks: [{ type: 'host-card', title: 'Hello from the host' }] },
  ],
};

// No table brings a block check, so an unprepared deck needs the built-in one (a lazy chunk).
const renderers = { free: () => HostFreeSlide };
const stageRoot = () => document.querySelector<HTMLElement>('.tx-deck-stage');
const hostSlide = () => document.querySelector('[data-host-free]');

function reset() {
  loaders.migration = 0;
  loaders.builtin = 0;
}

afterEach(() => {
  vi.restoreAllMocks();
  reset();
});

describe('a prepared deck on the stage (G83)', () => {
  it('brands only the results of the prepare functions', () => {
    const prepared = prepareDeckV2(hostDeck, { validateBlock: () => undefined });
    expect(prepared.ok).toBe(true);
    expect(isPreparedDeck(prepared)).toBe(true);
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(isPreparedDeck(prepareDeck(hostDeck, { validateBlock: () => undefined }))).toBe(true);
    const lookAlikes = [
      { ...prepared },
      JSON.parse(JSON.stringify(prepared)),
      structuredClone(prepared),
      hostDeck,
      null,
      'prepared',
    ];
    for (const value of lookAlikes) expect(isPreparedDeck(value)).toBe(false);
    // A failed preparation is never trusted.
    expect(
      isPreparedDeck(prepareDeckV2({ formatVersion: 2 }, { validateBlock: () => undefined }))
    ).toBe(false);
    // `prepareDeckV2` refuses an earlier deck shape (it brings no migration).
    expect(prepareDeckV2({ slides: [] }, { validateBlock: () => undefined }).ok).toBe(false);
  });

  it('paints a prepared deck on the first render at the developer tier, loading no validation chunk', async () => {
    await scenario(
      'developer tier: first-render paint',
      async () => {
        const deck = prepareDeckV2(hostDeck, { validateBlock: () => undefined });
        render(DeckStageCore, { props: { deck, tier: 'developer', loadTheme: null, renderers } });
        expect(stageRoot()?.getAttribute('aria-busy')).toBeNull();
        expect(hostSlide()?.textContent?.trim()).toBe('Hello from the host');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(loaders).toEqual({ migration: 0, builtin: 0 });
      },
      reset
    );

    await scenario(
      'untrusted tier: the prepared deck is validated again',
      async () => {
        const deck = prepareDeckV2(hostDeck, { validateBlock: () => undefined });
        render(DeckStageCore, { props: { deck, loadTheme: null, renderers } });
        expect(stageRoot()?.getAttribute('aria-busy')).toBe('true');
        expect(loaders.builtin).toBeGreaterThan(0);
        // The built-in block check refuses the host's block type: nothing unchecked paints.
        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('This deck could not be shown.')
        );
        expect(hostSlide()).toBeNull();
      },
      reset
    );

    await scenario(
      'a look-alike object at the developer tier is validated like any input',
      async () => {
        const forged = { ok: true, deck: hostDeck, from: 'v2', issues: [] };
        render(DeckStageCore, {
          props: { deck: forged, tier: 'developer', loadTheme: null, renderers },
        });
        expect(stageRoot()?.getAttribute('aria-busy')).toBe('true');
        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
        expect(hostSlide()).toBeNull();
        expect(loaders.migration).toBeGreaterThan(0);
      },
      reset
    );

    await scenario(
      'a plain deck at the developer tier is still validated',
      async () => {
        render(DeckStageCore, {
          props: { deck: hostDeck, tier: 'developer', loadTheme: null, renderers },
        });
        // The built-in check (loaded by now) refuses the host block: nothing unchecked paints.
        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
        expect(hostSlide()).toBeNull();
      },
      reset
    );
  });
});

/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DECK_STAGE_HOST_PACKAGE,
  type DeckPlayerHost,
  type DeckPlayerHostRequest,
  isLayoutDeckTree,
} from '../src/deck-host.ts';
import Player from '../src/Player.svelte';
import { scenario } from './scenario.ts';

afterEach(cleanup);

const deckTree = {
  id: 'layout-deck',
  props: { title: 'Hosted deck' },
  children: [
    {
      id: 'deck-slide',
      props: { slideId: 'one', title: 'One' },
      children: [
        {
          id: 'blocks-text',
          props: { block: { type: 'text', markdown: 'Hello from the deck.' } },
        },
      ],
    },
  ],
};

const docTree = {
  id: 'layout-doc',
  props: { title: 'Doc' },
  children: [
    {
      id: 'blocks-text',
      props: { block: { type: 'text', markdown: 'Body' } },
    },
  ],
};

describe('isLayoutDeckTree', () => {
  it('detects catalog trees and render roots', () => {
    expect(isLayoutDeckTree(deckTree)).toBe(true);
    expect(isLayoutDeckTree({ kind: 'component', id: 'layout-deck' })).toBe(true);
    expect(isLayoutDeckTree({ id: 'layout-page' })).toBe(false);
    expect(isLayoutDeckTree(null)).toBe(false);
  });
});

describe('Player chrome={false}', () => {
  it('paints no label heading, skip link or end anchor', async () => {
    await scenario('headingless embed has no chrome', async () => {
      const { container } = render(Player, {
        props: {
          blueprint: docTree,
          label: 'Embedded',
          chrome: false,
          landmarks: false,
        },
      });
      await waitFor(() => {
        expect(container.querySelector('[data-tx-player]')).toBeTruthy();
      });
      await tick();
      const root = container.querySelector('[data-tx-player]');
      expect(root?.getAttribute('data-tx-player-chrome')).toBe('off');
      expect(container.querySelector('.tx-player__chrome')).toBeNull();
      expect(container.querySelector('.tx-player__skip')).toBeNull();
      expect(container.querySelector('.tx-player__end')).toBeNull();
      expect(container.querySelector('.tx-player__label')).toBeNull();
    });
  });
});

describe('DeckPlayerHost seam', () => {
  it('records that full stage rendering lives in @texuli/slides', () => {
    expect(DECK_STAGE_HOST_PACKAGE).toBe('@texuli/slides');
  });

  it('calls a mock host for layout-deck and skips document paint', async () => {
    await scenario('mock host receives the layout-deck', async () => {
      const presented: unknown[] = [];
      const stop = vi.fn();
      const host: DeckPlayerHost = {
        present(request) {
          presented.push({
            id: (request.tree as { id?: string }).id,
            tier: request.tier,
            label: request.label,
            active: request.active,
          });
          return stop;
        },
      };

      const { container } = render(Player, {
        props: {
          blueprint: deckTree,
          label: 'Deck preview',
          deckHost: host,
          chrome: false,
        },
      });

      await waitFor(() => {
        expect(presented.length).toBeGreaterThanOrEqual(1);
      });
      expect(presented[0]).toMatchObject({
        id: 'layout-deck',
        label: 'Deck preview',
        tier: 'untrusted',
      });
      expect(container.querySelector('[data-tx-player-deck-host]')).toBeTruthy();
      expect(container.querySelector('[data-tx-player-deck-host-surface]')).toBeTruthy();
      // Document-flow deck article is not painted when the host owns it.
      expect(container.querySelector('.tx-player-layout--deck')).toBeNull();

      cleanup();
      expect(stop).toHaveBeenCalled();
    });
  });

  it('presents once: label, active and root changes are live, never a re-present', async () => {
    await scenario('toggling active does not re-present the deck', async () => {
      const requests: DeckPlayerHostRequest[] = [];
      const stop = vi.fn();
      const present = vi.fn((request: DeckPlayerHostRequest) => {
        requests.push(request);
        return stop;
      });
      const { container, rerender } = render(Player, {
        props: { blueprint: deckTree, label: 'Deck preview', deckHost: { present }, active: true },
      });
      await waitFor(() => {
        expect(present).toHaveBeenCalledTimes(1);
      });
      const request = requests[0] as DeckPlayerHostRequest;
      expect(request.active).toBe(true);
      expect(request.root).toBe(container.querySelector('[data-tx-player]'));

      for (const props of [{ active: false }, { active: true }, { label: 'Renamed deck' }]) {
        await rerender(props);
        await tick();
      }
      expect(present).toHaveBeenCalledTimes(1);
      expect(stop).not.toHaveBeenCalled();
      // The one request reads the current values.
      expect(request.label).toBe('Renamed deck');
      await rerender({ active: false });
      await tick();
      expect(request.active).toBe(false);

      // A new tier is a new presentation: clean up, then present again.
      await rerender({ tier: 'developer' });
      await waitFor(() => {
        expect(present).toHaveBeenCalledTimes(2);
      });
      expect(stop).toHaveBeenCalledTimes(1);
      expect(requests[1]?.tier).toBe('developer');

      // A new blueprint is a new presentation too, with its own validated tree.
      const retitled = { ...deckTree, props: { title: 'Retitled deck' } };
      await rerender({ blueprint: retitled });
      await waitFor(() => {
        expect(present).toHaveBeenCalledTimes(3);
      });
      expect(stop).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(requests[2]?.tree)).toContain('Retitled deck');
    });
  });

  it('keeps document paint when no deckHost is provided', async () => {
    await scenario('document-flow deck without a host', async () => {
      const { container } = render(Player, {
        props: {
          blueprint: deckTree,
          label: 'Document deck',
        },
      });
      await waitFor(() => {
        expect(container.querySelector('.tx-player-layout--deck')).toBeTruthy();
      });
      expect(container.querySelector('[data-tx-player-deck-host-surface]')).toBeNull();
    });
  });
});

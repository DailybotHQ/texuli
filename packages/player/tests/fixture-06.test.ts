import { render, waitFor, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { frameStops } from '../src/keyboard.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';
import {
  count,
  countInput,
  frameName,
  idTree,
  loadGolden,
  paintCore,
  paintedIds,
} from './golden-helpers.ts';

/**
 * Golden fixture 06 (presentation slide: a deck holding one card with a
 * stepped list and a bar chart) through the real player and real painters.
 * The numbers come from tests/fixtures/golden/golden-expectations.json.
 */

const { fixture, expected } = loadGolden('06-presentation-slide.json', '06-presentation-slide');

describe('golden fixture 06 through createPlayer and the real painters', () => {
  it('declares the pinned tier, node count and no frame', () => {
    expect(fixture.tier).toBe(expected.tier);
    expect(countInput(fixture.tree)).toBe(expected.nodes);
    // No artifact frame is pinned, and the fixture declares none.
    expect(expected.frame).toBeNull();
    expect(fixture.frame ?? null).toBeNull();
  });

  it('paints exactly the pinned components and placeholders at its tier, with no diagnostics', async () => {
    const { painted, state } = await paintCore(fixture.tree, fixture.tier);
    expect(state.validation.ok).toBe(true);
    expect(state.validation.diagnostics).toEqual([]);
    expect(state.paintIssues).toEqual([]);
    expect(count(painted, 'component')).toBe(expected.components);
    expect(count(painted, 'placeholder')).toBe(expected.placeholders);
    expect(painted.map(paintedIds)).toEqual([idTree(fixture.tree)]);
  }, 30_000);

  it('paints the same at the opposite tier, as pinned', async () => {
    const { painted } = await paintCore(fixture.tree, expected.cross.tier);
    expect(count(painted, 'placeholder')).toBe(expected.cross.placeholders);
    expect(count(painted, 'component')).toBe(expected.components);
  }, 30_000);
});

describe('golden fixture 06 in the Player', () => {
  async function mountFixture(extra: Record<string, unknown> = {}) {
    const errors: unknown[] = [];
    const view = render(Player, {
      props: {
        blueprint: fixture.tree,
        tier: fixture.tier,
        loaders: PLAYER_LOADERS,
        onNodeError: (error: unknown) => errors.push(error),
        ...extra,
      },
    });
    await waitFor(
      () => {
        expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull();
        expect(view.container.querySelector('[data-tx-block="list"]')).not.toBeNull();
        expect(
          view.container.querySelector('[data-tx-player-surface] h2:not(.tx-player-layout__title)')
        ).not.toBeNull();
      },
      { timeout: 20_000 }
    );
    return { ...view, errors };
  }

  it('shows the default chrome with the trust badge, since no frame is pinned', async () => {
    const { container } = await mountFixture();
    const chrome = container.querySelector('.tx-player__chrome') as HTMLElement;
    expect(within(chrome).getByRole('heading', { level: 2 }).textContent).toBe('Blueprint preview');
    expect(container.querySelector('[data-tx-player-trust]')?.textContent).toBe(
      'Untrusted content'
    );
    expect(within(chrome).getByText('Draft')).toBeTruthy();
  }, 30_000);

  it('paints the outline the grammar checked: titles at their titleHeading ranks', async () => {
    const { container } = await mountFixture();
    const surface = container.querySelector('[data-tx-player-surface]') as HTMLElement;
    const outline = Array.from(surface.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
      (heading) => `${heading.tagName.toLowerCase()} ${heading.textContent?.trim()}`
    );
    expect(outline).toEqual([
      'h1 Harborline Q4 kickoff', // layout-deck: titleHeading 1
      'h2 Where we are', // layout-card: nested under the deck
      'h2 Teams onboarded per month', // charts-bar: fixed rank 2
    ]);
  }, 30_000);

  it('paints the deck as a document flow: frames, every list step visible, no placeholders', async () => {
    const { container, errors } = await mountFixture();
    expect(frameStops(container).map(frameName)).toEqual(['Harborline Q4 kickoff', 'Where we are']);
    expect(container.querySelector('article.tx-player-layout--deck')).not.toBeNull();
    // step/reveal are presenter fields: in the document flow nothing waits for a step.
    const list = container.querySelector('[data-tx-block="list"]') as HTMLElement;
    expect(Array.from(list.querySelectorAll('li')).map((item) => item.textContent?.trim())).toEqual(
      [
        'Boards beta reached 1,200 teams',
        'Median setup time is 6 minutes',
        'Mobile check-ins ship in November',
      ]
    );
    expect(list.closest('[hidden], [aria-hidden="true"], [inert]')).toBeNull();
    expect(container.querySelectorAll('[data-tx-player-error]')).toHaveLength(0);
    expect(errors).toEqual([]);
  }, 30_000);

  it('is interactive when active and inert when not, at the declared tier', async () => {
    const active = await mountFixture();
    expect(active.container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')).toBe(
      false
    );
    active.unmount();
    const inactive = await mountFixture({ active: false });
    expect(
      inactive.container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')
    ).toBe(true);
    expect(
      inactive.container.querySelector('[data-tx-player-trust]')?.closest('[inert]')
    ).toBeNull();
  }, 60_000);
});

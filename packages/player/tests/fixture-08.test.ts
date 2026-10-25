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
 * Golden fixture 08 (proactive deck: a planning deck prepared before a
 * meeting, shown in an artifact frame) through the real player and real
 * painters. The numbers come from tests/fixtures/golden/golden-expectations.json.
 */

const { fixture, expected } = loadGolden('08-proactive-deck.json', '08-proactive-deck');
const fixtureFrame = fixture.frame as { label: string };
const pinnedFrame = expected.frame as { ok: boolean; label: string; badge: string };

describe('golden fixture 08 through createPlayer and the real painters', () => {
  it('declares the pinned tier and node count', () => {
    expect(fixture.tier).toBe(expected.tier);
    expect(countInput(fixture.tree)).toBe(expected.nodes);
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

describe('golden fixture 08 in the Player', () => {
  async function mountFixture(extra: Record<string, unknown> = {}) {
    const errors: unknown[] = [];
    const view = render(Player, {
      props: {
        blueprint: fixture.tree,
        tier: fixture.tier,
        label: fixtureFrame.label,
        loaders: PLAYER_LOADERS,
        onNodeError: (error: unknown) => errors.push(error),
        ...extra,
      },
    });
    await waitFor(
      () => {
        expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull();
        expect(view.container.querySelectorAll('[data-tx-block]')).toHaveLength(5);
        expect(view.container.querySelector('[data-tx-player-surface] svg')).not.toBeNull();
      },
      { timeout: 20_000 }
    );
    return { ...view, errors };
  }

  it('shows the pinned frame chrome: label and trust badge, always visible', async () => {
    const { container } = await mountFixture();
    expect(pinnedFrame.ok).toBe(true);
    const chrome = container.querySelector('.tx-player__chrome') as HTMLElement;
    expect(within(chrome).getByRole('heading', { level: 2 }).textContent).toBe(pinnedFrame.label);
    expect(container.querySelector('[data-tx-player-trust]')?.textContent).toBe(pinnedFrame.badge);
    expect(within(chrome).getByText('Draft')).toBeTruthy();
  }, 30_000);

  it('paints the outline the grammar checked: titles at their titleHeading ranks', async () => {
    const { container } = await mountFixture();
    const surface = container.querySelector('[data-tx-player-surface]') as HTMLElement;
    const outline = Array.from(surface.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
      (heading) => `${heading.tagName.toLowerCase()} ${heading.textContent?.trim()}`
    );
    expect(outline).toEqual([
      'h1 Afternoon planning, 2026-10-24', // layout-deck: titleHeading 1
      'h2 Agenda', // layout-card: nested under the deck
      'h2 Since Tuesday',
      'h2 Burn-down',
      'h2 Remaining items this sprint', // charts-line: fixed rank 2
      'h2 Risks', // the callout title is emphasis, not a heading
      'h2 Decisions needed',
    ]);
  }, 30_000);

  it('paints the deck as a document flow: frames, blocks in order, every step visible', async () => {
    const { container, errors } = await mountFixture();
    expect(frameStops(container).map(frameName)).toEqual([
      'Afternoon planning, 2026-10-24',
      'Agenda',
      'Since Tuesday',
      'Burn-down',
      'Risks',
      'Decisions needed',
    ]);
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('[data-tx-block]'));
    expect(blocks.map((block) => block.getAttribute('data-tx-block'))).toEqual([
      'list',
      'stat',
      'callout',
      'list',
      'list',
    ]);
    // The agenda is an ordered list; the stepped risk list shows in the flow.
    expect(blocks[0]?.tagName).toBe('OL');
    expect(blocks[0]?.querySelectorAll('li')).toHaveLength(4);
    expect(blocks[3]?.textContent).toContain('Payments sandbox access approved this morning');
    expect(blocks[3]?.closest('[hidden], [aria-hidden="true"], [inert]')).toBeNull();
    expect(blocks[2]?.getAttribute('data-tone')).toBe('warning');
    for (const label of ['Items closed', 'New items', 'Blocked']) {
      expect(within(blocks[1] as HTMLElement).getByText(label)).toBeTruthy();
    }
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

import { render, screen, waitFor, within } from '@testing-library/svelte';
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
 * Golden fixture 02 (operations dashboard) through the real player and real
 * painters. The numbers come from tests/fixtures/golden/golden-expectations.json,
 * the file the golden runner and the catalog gate enforce; nothing here
 * re-pins them.
 */

const { fixture, expected } = loadGolden('02-dashboard.json', '02-dashboard');
const fixtureFrame = fixture.frame as { label: string };
const pinnedFrame = expected.frame as { ok: boolean; label: string; badge: string };

describe('golden fixture 02 through createPlayer and the real painters', () => {
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
    // Every painter loaded and mounted: the painted tree is the input tree.
    expect(painted.map(paintedIds)).toEqual([idTree(fixture.tree)]);
  }, 30_000);

  it('paints the same at the opposite tier, as pinned', async () => {
    const { painted } = await paintCore(fixture.tree, expected.cross.tier);
    expect(count(painted, 'placeholder')).toBe(expected.cross.placeholders);
    expect(count(painted, 'component')).toBe(expected.components);
  }, 30_000);
});

describe('golden fixture 02 in the Player', () => {
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
        expect(view.container.querySelectorAll('[data-tx-block]')).toHaveLength(2);
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
      'h1 Support operations, week 42', // layout-page: titleHeading 1
      'h2 Tickets per day', // layout-card: nested under the page
      'h2 Tickets per day', // charts-line: fixed rank 2
      'h2 Channel mix',
      'h3 Tickets by channel', // charts-donut: fixed rank 3
      'h2 Backlog by team',
      'h2 Open backlog by team', // charts-bar: fixed rank 2
      'h2 Response-time target', // charts-gauge: compact, no heading
      'h2 Oldest open tickets',
    ]);
  }, 30_000);

  it('paints every node: frames in reading order, data blocks, no placeholders or node errors', async () => {
    const { container, errors } = await mountFixture();
    const frames = frameStops(container).map(frameName);
    expect(frames).toEqual([
      'MAIN',
      'DIV',
      'Tickets per day',
      'Channel mix',
      'Backlog by team',
      'Response-time target',
      'Oldest open tickets',
    ]);
    expect(
      Array.from(container.querySelectorAll('[data-tx-block]')).map((b) =>
        b.getAttribute('data-tx-block')
      )
    ).toEqual(['kpi', 'table']);
    for (const label of [
      'Tickets opened',
      'Tickets solved',
      'Median first response',
      'Satisfaction',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const table = screen.getByRole('table', { name: 'Five oldest open tickets' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
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
    // The trust badge stays visible on an inactive frame.
    expect(
      inactive.container.querySelector('[data-tx-player-trust]')?.closest('[inert]')
    ).toBeNull();
  }, 60_000);
});

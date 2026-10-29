// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type ActivityItem,
  groupByDay,
  kindVerb,
  pageItems,
  reactionChips,
  sortActivity,
  whenLabel,
} from '../src/activity/index.ts';
import ActivityFeedHarness from './fixtures/ActivityFeedHarness.svelte';

afterEach(cleanup);

const sample: ActivityItem[] = [
  {
    id: 'b',
    at: '2026-02-12T10:00:00.000Z',
    actorId: 'a',
    kind: 'create',
    lines: ['created'],
  },
  {
    id: 'a',
    at: '2026-02-12T12:00:00.000Z',
    actorId: 'a',
    kind: 'update',
    lines: ['updated'],
    seq: 2,
  },
  {
    id: 'c',
    at: '2026-02-11T12:00:00.000Z',
    actorId: 'a',
    kind: 'delete',
    lines: ['deleted'],
  },
];

describe('@texuli/data/activity model helpers', () => {
  it('pages, chips and re-exports engine sort/group helpers', () => {
    expect(pageItems(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
    expect(pageItems(['a'], 0)).toEqual([]);
    expect(reactionChips({ '👍': ['p1', 'p2'], '🎉': ['p1'] }, 'p1')).toEqual([
      { emoji: '👍', count: 2, mine: true, personaIds: ['p1', 'p2'] },
      { emoji: '🎉', count: 1, mine: true, personaIds: ['p1'] },
    ]);
    expect(kindVerb('comment')).toBe('commented');
    expect(sortActivity(sample).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    const groups = groupByDay(sortActivity(sample), {
      at: (item) => item.at,
      now: '2026-02-12T18:00:00.000Z',
      timeZone: 'UTC',
    });
    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
  });
});

describe('day labels with blueprint strings', () => {
  it('falls back to UTC for an unknown time zone and en-US for an invalid locale instead of throwing', () => {
    const now = '2026-02-12T18:00:00.000Z';
    const at = '2026-02-12T15:04:00.000Z';
    const expected = whenLabel(at, { now, timeZone: 'UTC', locale: 'en-US' });
    expect(expected).toBe('Today, 3:04 PM');
    for (const options of [
      { timeZone: 'Not/AZone' },
      { locale: 'not a locale!' },
      { timeZone: '', locale: '' },
      { timeZone: 'Mars/Olympus_Mons', locale: 'xx-!!' },
    ]) {
      expect(whenLabel(at, { now, ...options }), JSON.stringify(options)).toBe(expected);
      expect(
        groupByDay([{ at }], { at: (item) => item.at, now, ...options }).map((g) => g.label),
        JSON.stringify(options)
      ).toEqual(['Today']);
    }
    // A valid zone and locale still apply.
    expect(whenLabel(at, { now, timeZone: 'Asia/Tokyo', locale: 'en-GB' })).toBe('Today, 0:04');
  });
});

describe('ActivityFeed', () => {
  it('groups items by day with avatars and comment mentions, and 4 related cases', async () => {
    // groups items by day with avatars and comment mentions
    await (async () => {
      render(ActivityFeedHarness);
      expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
      expect(screen.getByText('@Li Chen')).toBeTruthy();
      expect(screen.getByText('#Acme renewal')).toBeTruthy();
      expect(document.querySelectorAll('[data-activity-id]').length).toBe(2); // pageSize 2
      await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeTruthy());
      expect(screen.getAllByText('Marta Ruiz').length).toBeGreaterThan(0);
    })();
    cleanup();
    // loads more items from the local page window
    await (async () => {
      render(ActivityFeedHarness);
      expect(document.querySelectorAll('[data-activity-id]').length).toBe(2);
      await fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
      await waitFor(() =>
        expect(document.querySelectorAll('[data-activity-id]').length).toBeGreaterThan(2)
      );
    })();
    cleanup();
    // toggles a reaction for the current persona
    await (async () => {
      render(ActivityFeedHarness);
      const react = screen.getAllByRole('button', { name: /React with 👍/ })[0]!;
      await fireEvent.click(react);
      await waitFor(() =>
        expect(screen.getByLabelText('Reaction thumbs').textContent).toBe('p-li,p-marta')
      );
      await fireEvent.click(screen.getAllByRole('button', { name: /React with 👍/ })[0]!);
      await waitFor(() =>
        expect(screen.getByLabelText('Reaction thumbs').textContent).toBe('p-li')
      );
    })();
    cleanup();
    // filters by activity kind
    await (async () => {
      render(ActivityFeedHarness);
      await fireEvent.click(screen.getByRole('button', { name: 'created' }));
      await waitFor(() => expect(screen.getByLabelText('Filter kinds').textContent).toBe('create'));
      const kinds = [...document.querySelectorAll('[data-activity-id]')].map((el) =>
        el.getAttribute('data-kind')
      );
      expect(kinds.length).toBeGreaterThan(0);
      expect(kinds.every((kind) => kind === 'create')).toBe(true);
    })();
    cleanup();
    // moves focus with arrow keys and opens on Enter
    await (async () => {
      render(ActivityFeedHarness);
      const first = document.querySelector<HTMLElement>('[data-activity-id]');
      expect(first).toBeTruthy();
      first!.focus();
      await fireEvent.keyDown(first!, { key: 'ArrowDown' });
      const second = document.activeElement as HTMLElement;
      expect(second?.getAttribute('data-activity-id')).toBeTruthy();
      expect(second?.getAttribute('data-activity-id')).not.toBe(
        first!.getAttribute('data-activity-id')
      );
      await fireEvent.keyDown(second, { key: 'Enter' });
      await waitFor(() => expect(screen.getByLabelText('Open count').textContent).toBe('1'));
    })();
  });
});

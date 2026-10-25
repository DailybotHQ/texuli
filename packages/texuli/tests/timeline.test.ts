/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMELINE_MESSAGES,
  TIMELINE_STATUSES,
  TIMELINE_TONES,
  Timeline,
  TimelineItem,
  type TimelineItemData,
  timelineClass,
  timelineItemClass,
} from '../src/components/timeline/index.ts';
import TimelineHarness from './fixtures/TimelineHarness.svelte';

afterEach(cleanup);

const items: TimelineItemData[] = [
  {
    id: 'kickoff',
    time: 'Mar 4',
    datetime: '2026-03-04',
    title: 'Kickoff',
    description: 'Scope agreed with the fictional team.',
    status: 'complete',
    tone: 'success',
  },
  { id: 'review', time: 'Mar 18', title: 'Design review', status: 'current' },
  { id: 'launch', time: 'Apr 1', title: 'Launch', status: 'upcoming', tone: 'neutral' },
];

const listItems = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLLIElement>('[data-tx-timeline-item]'),
];

describe('Timeline', () => {
  it('renders an ordered list named "Timeline" with one item per entry', () => {
    const view = render(Timeline, { props: { items } });
    const list = view.getByRole('list', { name: 'Timeline' });
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(list.dataset.orientation).toBe('vertical');
    expect(list.className).toContain('tx-timeline--vertical');
    // A vertical timeline does not scroll sideways: it takes no Tab stop.
    expect(list.hasAttribute('tabindex')).toBe(false);
  });

  it('renders time, title and description, with a machine-readable date', () => {
    const view = render(Timeline, { props: { items } });
    const [first] = listItems(view.container);
    const time = first?.querySelector('time');
    expect(time?.textContent).toBe('Mar 4');
    expect(time?.getAttribute('datetime')).toBe('2026-03-04');
    expect(first?.querySelector('.tx-timeline__title')?.textContent).toBe('Kickoff, Completed');
    expect(first?.querySelector('.tx-timeline__description')?.textContent).toBe(
      'Scope agreed with the fictional team.'
    );
    // No datetime given: the <time> element has no datetime attribute.
    expect(listItems(view.container)[1]?.querySelector('time')?.hasAttribute('datetime')).toBe(
      false
    );
  });

  it('is horizontal on request, and then keyboard-scrollable', () => {
    const view = render(Timeline, {
      props: { items, orientation: 'horizontal', label: 'Roadmap' },
    });
    const list = view.getByRole('list', { name: 'Roadmap' });
    expect(list.dataset.orientation).toBe('horizontal');
    expect(list.className).toContain('tx-timeline--horizontal');
    expect(list.getAttribute('tabindex')).toBe('0');
  });

  it('says each status in words, marks the current item, and never relies on color alone', () => {
    const view = render(Timeline, { props: { items } });
    const [done, now, next] = listItems(view.container);
    expect(done?.dataset.status).toBe('complete');
    expect(done?.querySelector('.tx-timeline__marker svg')).not.toBeNull();
    expect(now?.getAttribute('aria-current')).toBe('step');
    expect(now?.querySelector('.tx-timeline__sr-only')?.textContent).toBe(', Current');
    expect(next?.querySelector('.tx-timeline__sr-only')?.textContent).toBe(', Upcoming');
    expect(next?.hasAttribute('aria-current')).toBe(false);
    for (const item of listItems(view.container)) {
      expect(item.querySelector('.tx-timeline__marker')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('renders every tone and every status', () => {
    for (const tone of TIMELINE_TONES) {
      for (const status of TIMELINE_STATUSES) {
        const view = render(Timeline, {
          props: { items: [{ title: `${tone} ${status}`, tone, status }] },
        });
        const [item] = listItems(view.container);
        expect(item?.dataset.tone).toBe(tone);
        expect(item?.dataset.status).toBe(status);
        expect(item?.className).toContain(`tx-timeline__item--${tone}`);
        expect(item?.textContent).toContain(DEFAULT_TIMELINE_MESSAGES[status]);
        view.unmount();
      }
    }
  });

  it('translates its label and status words, ignoring blank translations', () => {
    const view = render(Timeline, {
      props: {
        items,
        messages: {
          label: 'Cronología',
          complete: 'Completado',
          current: '  ',
          upcoming: 'Próximo',
        },
      },
    });
    expect(view.getByRole('list', { name: 'Cronología' })).toBeTruthy();
    const [done, now, next] = listItems(view.container);
    expect(done?.textContent).toContain('Completado');
    expect(now?.textContent).toContain('Current');
    expect(next?.textContent).toContain('Próximo');
  });

  it('passes every link through the URL policy', () => {
    const view = render(Timeline, {
      props: {
        items: [
          { title: 'Docs', href: 'https://example.com/docs' },
          { title: 'Relative', href: '/changelog' },
          { title: 'Script', href: 'javascript:alert(1)' },
          { title: 'Data', href: 'data:text/html,<p>x</p>' },
        ],
      },
    });
    expect(view.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe(
      'https://example.com/docs'
    );
    expect(view.getByRole('link', { name: 'Relative' }).getAttribute('href')).toBe('/changelog');
    // Rejected links render as text, never as an inert <a>.
    expect(view.queryByRole('link', { name: 'Script' })).toBeNull();
    expect(view.getByText('Script')).toBeTruthy();
    expect(view.queryByRole('link', { name: 'Data' })).toBeNull();
    expect(view.container.querySelectorAll('a')).toHaveLength(2);
  });

  it('applies the untrusted tier to agent or user content', () => {
    const view = render(Timeline, {
      props: {
        hrefTrust: 'untrusted',
        items: [
          { title: 'Secure', href: 'https://example.com/a' },
          { title: 'Relative', href: '/changelog' },
        ],
      },
    });
    expect(view.getByRole('link', { name: 'Secure' })).toBeTruthy();
    expect(view.queryByRole('link', { name: 'Relative' })).toBeNull();
  });

  it('merges a consumer class last', () => {
    const view = render(Timeline, { props: { items, class: 'my-timeline' } });
    const list = view.getByRole('list');
    expect(list.className).toBe('tx-timeline tx-timeline--vertical my-timeline');
    expect(timelineClass({ orientation: 'horizontal' })).toBe(
      'tx-timeline tx-timeline--horizontal'
    );
    expect(timelineItemClass({})).toBe('tx-timeline__item tx-timeline__item--default');
  });
});

describe('composition', () => {
  it('composes TimelineItem children with a custom icon and extra content', () => {
    const view = render(TimelineHarness, { props: { mode: 'compose' } });
    const list = view.getByRole('list', { name: 'Release plan' });
    expect(list.dataset.orientation).toBe('horizontal');
    const [draft, ship] = listItems(view.container);
    expect(
      within(draft as HTMLElement)
        .getByTestId('custom-icon')
        .closest('[aria-hidden]')
    ).not.toBeNull();
    // A custom icon replaces the check.
    expect(draft?.querySelector('.tx-timeline__marker svg')).toBeNull();
    expect(within(draft as HTMLElement).getByTestId('extra').textContent).toBe(
      'Owner: Ada Example'
    );
    expect(ship?.textContent).toContain('Upcoming');
  });

  it('renders the item snippet inside each data-driven item', () => {
    const view = render(TimelineHarness, { props: { mode: 'snippet' } });
    expect(view.getAllByTestId('meta').map((node) => node.textContent)).toEqual([
      '#1 kickoff',
      '#2 review',
    ]);
  });

  it('works on its own with the default words', () => {
    const view = render(TimelineItem, { props: { title: 'Alone', status: 'current' } });
    expect(view.container.querySelector('li')?.textContent).toContain('Alone, Current');
  });
});

describe('styles', () => {
  const css = readFileSync(
    join(import.meta.dirname, '../src/components/timeline/timeline.css'),
    'utf8'
  );

  it('live in the components layer, so consumer classes win', () => {
    expect(css).toMatch(/^@layer tx\.components \{/m);
  });

  it('use logical properties only, so the timeline mirrors in right-to-left', () => {
    const physical =
      /(?:^|[\s;{])(?:left|right|top|bottom|width|height|min-width|max-width|min-height|max-height|(?:margin|padding|border)-(?:left|right|top|bottom)(?:-[a-z]+)?)\s*:/m;
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(physical);
  });

  it('have a forced-colors fallback', () => {
    expect(css).toContain('@media (forced-colors: active)');
  });
});

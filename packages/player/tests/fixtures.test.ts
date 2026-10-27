import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
import { scenario } from './scenario.ts';

describe('golden fixture 02', () => {
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
    it('fixture 02 through createPlayer: pinned tier, node count and paint at both tiers', async () => {
      await scenario('declares the pinned tier and node count', async () => {
        expect(fixture.tier).toBe(expected.tier);
        expect(countInput(fixture.tree)).toBe(expected.nodes);
      });
      await scenario(
        'paints exactly the pinned components and placeholders at its tier, with no diagnostics',
        async () => {
          const { painted, state } = await paintCore(fixture.tree, fixture.tier);
          expect(state.validation.ok).toBe(true);
          expect(state.validation.diagnostics).toEqual([]);
          expect(state.paintIssues).toEqual([]);
          expect(count(painted, 'component')).toBe(expected.components);
          expect(count(painted, 'placeholder')).toBe(expected.placeholders);
          // Every painter loaded and mounted: the painted tree is the input tree.
          expect(painted.map(paintedIds)).toEqual([idTree(fixture.tree)]);
        }
      );
      await scenario('paints the same at the opposite tier, as pinned', async () => {
        const { painted } = await paintCore(fixture.tree, expected.cross.tier);
        expect(count(painted, 'placeholder')).toBe(expected.cross.placeholders);
        expect(count(painted, 'component')).toBe(expected.components);
      });
    }, 60000);
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

    it('fixture 02 in the Player: chrome, outline, every node, interactive only when active', async () => {
      await scenario(
        'shows the pinned frame chrome: label and trust badge, always visible',
        async () => {
          const { container } = await mountFixture();
          expect(pinnedFrame.ok).toBe(true);
          const chrome = container.querySelector('.tx-player__chrome') as HTMLElement;
          expect(within(chrome).getByRole('heading', { level: 2 }).textContent).toBe(
            pinnedFrame.label
          );
          expect(container.querySelector('[data-tx-player-trust]')?.textContent).toBe(
            pinnedFrame.badge
          );
          expect(within(chrome).getByText('Draft')).toBeTruthy();
        }
      );
      await scenario(
        'paints the outline the grammar checked: titles at their titleHeading ranks',
        async () => {
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
        }
      );
      await scenario(
        'paints every node: frames in reading order, data blocks, no placeholders or node errors',
        async () => {
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
        }
      );
      await scenario(
        'is interactive when active and inert when not, at the declared tier',
        async () => {
          const active = await mountFixture();
          expect(
            active.container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')
          ).toBe(false);
          active.unmount();
          const inactive = await mountFixture({ active: false });
          expect(
            inactive.container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')
          ).toBe(true);
          // The trust badge stays visible on an inactive frame.
          expect(
            inactive.container.querySelector('[data-tx-player-trust]')?.closest('[inert]')
          ).toBeNull();
        }
      );
    }, 150000);
  });
});

describe('golden fixture 06', () => {
  /**
   * Golden fixture 06 (presentation slide: a deck holding one card with a
   * stepped list and a bar chart) through the real player and real painters.
   * The numbers come from tests/fixtures/golden/golden-expectations.json.
   */

  const { fixture, expected } = loadGolden('06-presentation-slide.json', '06-presentation-slide');

  describe('golden fixture 06 through createPlayer and the real painters', () => {
    it('fixture 06 through createPlayer: pinned tier, node count and paint at both tiers', async () => {
      await scenario('declares the pinned tier, node count and no frame', async () => {
        expect(fixture.tier).toBe(expected.tier);
        expect(countInput(fixture.tree)).toBe(expected.nodes);
        // No artifact frame is pinned, and the fixture declares none.
        expect(expected.frame).toBeNull();
        expect(fixture.frame ?? null).toBeNull();
      });
      await scenario(
        'paints exactly the pinned components and placeholders at its tier, with no diagnostics',
        async () => {
          const { painted, state } = await paintCore(fixture.tree, fixture.tier);
          expect(state.validation.ok).toBe(true);
          expect(state.validation.diagnostics).toEqual([]);
          expect(state.paintIssues).toEqual([]);
          expect(count(painted, 'component')).toBe(expected.components);
          expect(count(painted, 'placeholder')).toBe(expected.placeholders);
          expect(painted.map(paintedIds)).toEqual([idTree(fixture.tree)]);
        }
      );
      await scenario('paints the same at the opposite tier, as pinned', async () => {
        const { painted } = await paintCore(fixture.tree, expected.cross.tier);
        expect(count(painted, 'placeholder')).toBe(expected.cross.placeholders);
        expect(count(painted, 'component')).toBe(expected.components);
      });
    }, 60000);
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
            view.container.querySelector(
              '[data-tx-player-surface] h2:not(.tx-player-layout__title)'
            )
          ).not.toBeNull();
        },
        { timeout: 20_000 }
      );
      return { ...view, errors };
    }

    it('fixture 06 in the Player: default chrome, outline, document-flow deck, interactive only when active', async () => {
      await scenario(
        'shows the default chrome with the trust badge, since no frame is pinned',
        async () => {
          const { container } = await mountFixture();
          const chrome = container.querySelector('.tx-player__chrome') as HTMLElement;
          expect(within(chrome).getByRole('heading', { level: 2 }).textContent).toBe(
            'Blueprint preview'
          );
          expect(container.querySelector('[data-tx-player-trust]')?.textContent).toBe(
            'Untrusted content'
          );
          expect(within(chrome).getByText('Draft')).toBeTruthy();
        }
      );
      await scenario(
        'paints the outline the grammar checked: titles at their titleHeading ranks',
        async () => {
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
        }
      );
      await scenario(
        'paints the deck as a document flow: frames, every list step visible, no placeholders',
        async () => {
          const { container, errors } = await mountFixture();
          expect(frameStops(container).map(frameName)).toEqual([
            'Harborline Q4 kickoff',
            'Where we are',
          ]);
          expect(container.querySelector('article.tx-player-layout--deck')).not.toBeNull();
          // step/reveal are presenter fields: in the document flow nothing waits for a step.
          const list = container.querySelector('[data-tx-block="list"]') as HTMLElement;
          expect(
            Array.from(list.querySelectorAll('li')).map((item) => item.textContent?.trim())
          ).toEqual([
            'Boards beta reached 1,200 teams',
            'Median setup time is 6 minutes',
            'Mobile check-ins ship in November',
          ]);
          expect(list.closest('[hidden], [aria-hidden="true"], [inert]')).toBeNull();
          expect(container.querySelectorAll('[data-tx-player-error]')).toHaveLength(0);
          expect(errors).toEqual([]);
        }
      );
      await scenario(
        'is interactive when active and inert when not, at the declared tier',
        async () => {
          const active = await mountFixture();
          expect(
            active.container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')
          ).toBe(false);
          active.unmount();
          const inactive = await mountFixture({ active: false });
          expect(
            inactive.container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')
          ).toBe(true);
          expect(
            inactive.container.querySelector('[data-tx-player-trust]')?.closest('[inert]')
          ).toBeNull();
        }
      );
    }, 150000);
  });
});

describe('golden fixture 07', () => {
  /**
   * Golden fixture 07 (report on demand: a document with section headings,
   * KPIs, two charts, a table, a callout, a list and a source link), painted
   * through the real player and real painters, and used: its contents,
   * chart controls, keyboard paths and link. The numbers come from
   * tests/fixtures/golden/golden-expectations.json.
   */

  const { fixture, expected } = loadGolden('07-report-on-demand.json', '07-report-on-demand');
  const fixtureFrame = fixture.frame as { label: string };
  const pinnedFrame = expected.frame as { ok: boolean; label: string; badge: string };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('golden fixture 07 through createPlayer and the real painters', () => {
    it('fixture 07 through createPlayer: pinned tier, node count and paint at both tiers', async () => {
      await scenario('declares the pinned tier and node count', async () => {
        expect(fixture.tier).toBe(expected.tier);
        expect(countInput(fixture.tree)).toBe(expected.nodes);
      });
      await scenario(
        'paints exactly the pinned components and placeholders at its tier, with no diagnostics',
        async () => {
          const { painted, state } = await paintCore(fixture.tree, fixture.tier);
          expect(state.validation.ok).toBe(true);
          expect(state.validation.diagnostics).toEqual([]);
          expect(state.paintIssues).toEqual([]);
          expect(count(painted, 'component')).toBe(expected.components);
          expect(count(painted, 'placeholder')).toBe(expected.placeholders);
          expect(painted.map(paintedIds)).toEqual([idTree(fixture.tree)]);
        }
      );
      await scenario('paints the same at the opposite tier, as pinned', async () => {
        const { painted } = await paintCore(fixture.tree, expected.cross.tier);
        expect(count(painted, 'placeholder')).toBe(expected.cross.placeholders);
        expect(count(painted, 'component')).toBe(expected.components);
      });
    }, 60000);
  });

  describe('golden fixture 07 in the Player: paint', () => {
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
          expect(view.container.querySelectorAll('[data-tx-block]')).toHaveLength(11);
          expect(view.container.querySelectorAll('.tx-chart-plot__explorer')).toHaveLength(2);
        },
        { timeout: 20_000 }
      );
      return { ...view, errors };
    }

    it('fixture 07 in the Player: chrome, outline, every block and the declared toc', async () => {
      await scenario('shows the pinned frame chrome: label and trust badge', async () => {
        const { container } = await mountFixture();
        expect(pinnedFrame.ok).toBe(true);
        const chrome = container.querySelector('.tx-player__chrome') as HTMLElement;
        expect(within(chrome).getByRole('heading', { level: 2 }).textContent).toBe(
          pinnedFrame.label
        );
        expect(container.querySelector('[data-tx-player-trust]')?.textContent).toBe(
          pinnedFrame.badge
        );
      });
      await scenario(
        'paints the document outline and every block, with no placeholders or node errors',
        async () => {
          const { container, errors } = await mountFixture();
          const surface = container.querySelector('[data-tx-player-surface]') as HTMLElement;
          const outline = Array.from(surface.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
            (heading) => `${heading.tagName.toLowerCase()} ${heading.textContent?.trim()}`
          );
          expect(outline).toEqual([
            'h1 Delivery report, week 42', // layout-doc: titleHeading 1
            'h2 Summary', // heading blocks keep their declared level
            'h2 Throughput',
            'h2 Items closed per team', // charts-stacked-bar: fixed rank 2
            'h2 Items closed per week', // the chart block's own title
            'h2 Blocked work',
            'h2 Next week',
          ]);
          expect(
            Array.from(surface.querySelectorAll('[data-tx-block]')).map((b) =>
              b.getAttribute('data-tx-block')
            )
          ).toEqual([
            'heading',
            'text',
            'kpi',
            'heading',
            'chart',
            'heading',
            'table',
            'callout',
            'heading',
            'list',
            'text',
          ]);
          expect(frameStops(container)).toHaveLength(1);
          expect(container.querySelectorAll('[data-tx-player-error]')).toHaveLength(0);
          expect(errors).toEqual([]);
        }
      );
      await scenario(
        'lists the declared toc: the section headings, as contents links that focus the section',
        async () => {
          const { container } = await mountFixture();
          const nav = screen.getByRole('navigation', { name: 'Contents' });
          const links = within(nav).getAllByRole('link');
          expect(links.map((link) => link.textContent)).toEqual([
            'Summary',
            'Throughput',
            'Blocked work',
            'Next week',
          ]);
          expect(links.map((link) => link.parentElement?.getAttribute('data-level'))).toEqual([
            '2',
            '2',
            '2',
            '2',
          ]);
          await fireEvent.click(links[2] as HTMLElement);
          const target = document.activeElement as HTMLElement;
          expect(target.hasAttribute('data-tx-player-anchor')).toBe(true);
          expect(target.id).toBe(links[2]?.getAttribute('href')?.slice(1));
          expect(within(target).getByRole('heading', { level: 2 }).textContent).toBe(
            'Blocked work'
          );
          expect(container.querySelector('[data-tx-player-surface]')?.contains(target)).toBe(true);
        }
      );
    }, 90000);
  });

  describe('golden fixture 07 in the Player: interaction', () => {
    async function mountFixture(extra: Record<string, unknown> = {}) {
      const view = render(Player, {
        props: {
          blueprint: fixture.tree,
          tier: fixture.tier,
          label: fixtureFrame.label,
          loaders: PLAYER_LOADERS,
          ...extra,
        },
      });
      await waitFor(
        () => {
          expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull();
          expect(view.container.querySelectorAll('.tx-chart-plot__explorer')).toHaveLength(2);
          expect(view.container.querySelector('.tx-md-link')).not.toBeNull();
        },
        { timeout: 20_000 }
      );
      await tick();
      return view;
    }

    function tabStops(root: ParentNode): string[] {
      return Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')
      )
        .filter((element) => element.getAttribute('tabindex') !== '-1')
        .filter((element) => !element.closest('[inert]'))
        .map((element) => {
          const name = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
          return element.getAttribute('role') === 'application' ? `chart explorer` : name;
        });
    }

    it('fixture 07 interaction: Tab order, chart keys, Escape and F6, local-only state, inactive frames', async () => {
      await scenario(
        'Tab visits skip link, contents, chart controls and the source link, in reading order',
        async () => {
          const { container } = await mountFixture();
          expect(tabStops(container)).toEqual([
            `Skip past ${fixtureFrame.label}`,
            'Summary',
            'Throughput',
            'Blocked work',
            'Next week',
            'Features',
            'Fixes',
            'chart explorer',
            'Show data table',
            'chart explorer',
            'Show data table',
            'week 42 board export',
          ]);
        }
      );
      await scenario(
        'chart keys stay with the chart: arrows move its point, its Escape is its own',
        async () => {
          const { container } = await mountFixture();
          const explorer = container.querySelector<HTMLElement>(
            '.tx-chart-plot__explorer'
          ) as HTMLElement;
          explorer.focus();
          const arrow = new KeyboardEvent('keydown', {
            key: 'ArrowRight',
            bubbles: true,
            cancelable: true,
          });
          explorer.dispatchEvent(arrow);
          await tick();
          expect(document.activeElement).toBe(explorer);
          expect(explorer.getAttribute('aria-activedescendant')).toBeTruthy();
          expect(container.querySelector('[data-tx-player-surface]')?.textContent).toContain(
            'Point 2 of 3'
          );
          // The chart handles its first Escape (leaving point mode); the player leaves it alone.
          const escapeKey = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
          });
          explorer.dispatchEvent(escapeKey);
          await tick();
          expect(escapeKey.defaultPrevented).toBe(true);
          expect(document.activeElement).toBe(explorer);
        }
      );
      await scenario(
        'the source link walks outward with Escape and F6 reaches the document frame',
        async () => {
          const { container } = await mountFixture();
          const link = screen.getByRole('link', { name: 'week 42 board export' });
          expect(link.getAttribute('href')).toBe('https://example.com/reports/w42.csv');
          link.focus();
          await fireEvent.keyDown(link, { key: 'Escape', bubbles: true, cancelable: true });
          const doc = frameStops(container)[0];
          expect(document.activeElement).toBe(doc);
          await fireEvent.keyDown(doc as Element, {
            key: 'Escape',
            bubbles: true,
            cancelable: true,
          });
          expect(document.activeElement).toBe(container.querySelector('.tx-player__label'));
          link.focus();
          await fireEvent.keyDown(link, { key: 'F6', bubbles: true, cancelable: true });
          expect(document.activeElement).toBe(doc);
        }
      );
      await scenario(
        'chart controls change only local component state: no host callback, re-validation or network',
        async () => {
          const fetchSpy = vi.spyOn(globalThis, 'fetch');
          const onStateChange = vi.fn();
          const onDiagnostics = vi.fn();
          const { container } = await mountFixture({ onStateChange, onDiagnostics });
          expect(onDiagnostics).toHaveBeenCalledTimes(1);

          const legend = screen.getByRole('button', { name: 'Features' });
          expect(legend.getAttribute('aria-pressed')).toBe('true');
          await fireEvent.click(legend);
          expect(legend.getAttribute('aria-pressed')).toBe('false');

          const toggle = within(
            container.querySelector('[data-tx-player-surface]') as HTMLElement
          ).getAllByRole('button', { name: 'Show data table' })[0] as HTMLElement;
          const tables = container.querySelectorAll('table').length;
          await fireEvent.click(toggle);
          expect(toggle.getAttribute('aria-expanded')).toBe('true');
          expect(container.querySelectorAll('table').length).toBe(tables + 1);

          expect(onStateChange).not.toHaveBeenCalled();
          expect(onDiagnostics).toHaveBeenCalledTimes(1);
          expect(fetchSpy).not.toHaveBeenCalled();
        }
      );
      await scenario(
        'an inactive frame takes no focus or input; the trust badge stays visible',
        async () => {
          const { container } = await mountFixture({ active: false });
          expect(container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')).toBe(
            true
          );
          expect(tabStops(container)).toEqual([`Skip past ${fixtureFrame.label}`]);
          expect(container.querySelector('[data-tx-player-trust]')?.closest('[inert]')).toBeNull();
        }
      );
    }, 150000);
  });
});

describe('golden fixture 08', () => {
  /**
   * Golden fixture 08 (proactive deck: a planning deck prepared before a
   * meeting, shown in an artifact frame) through the real player and real
   * painters. The numbers come from tests/fixtures/golden/golden-expectations.json.
   */

  const { fixture, expected } = loadGolden('08-proactive-deck.json', '08-proactive-deck');
  const fixtureFrame = fixture.frame as { label: string };
  const pinnedFrame = expected.frame as { ok: boolean; label: string; badge: string };

  describe('golden fixture 08 through createPlayer and the real painters', () => {
    it('fixture 08 through createPlayer: pinned tier, node count and paint at both tiers', async () => {
      await scenario('declares the pinned tier and node count', async () => {
        expect(fixture.tier).toBe(expected.tier);
        expect(countInput(fixture.tree)).toBe(expected.nodes);
      });
      await scenario(
        'paints exactly the pinned components and placeholders at its tier, with no diagnostics',
        async () => {
          const { painted, state } = await paintCore(fixture.tree, fixture.tier);
          expect(state.validation.ok).toBe(true);
          expect(state.validation.diagnostics).toEqual([]);
          expect(state.paintIssues).toEqual([]);
          expect(count(painted, 'component')).toBe(expected.components);
          expect(count(painted, 'placeholder')).toBe(expected.placeholders);
          expect(painted.map(paintedIds)).toEqual([idTree(fixture.tree)]);
        }
      );
      await scenario('paints the same at the opposite tier, as pinned', async () => {
        const { painted } = await paintCore(fixture.tree, expected.cross.tier);
        expect(count(painted, 'placeholder')).toBe(expected.cross.placeholders);
        expect(count(painted, 'component')).toBe(expected.components);
      });
    }, 60000);
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

    it('fixture 08 in the Player: chrome, outline, document-flow deck, interactive only when active', async () => {
      await scenario(
        'shows the pinned frame chrome: label and trust badge, always visible',
        async () => {
          const { container } = await mountFixture();
          expect(pinnedFrame.ok).toBe(true);
          const chrome = container.querySelector('.tx-player__chrome') as HTMLElement;
          expect(within(chrome).getByRole('heading', { level: 2 }).textContent).toBe(
            pinnedFrame.label
          );
          expect(container.querySelector('[data-tx-player-trust]')?.textContent).toBe(
            pinnedFrame.badge
          );
          expect(within(chrome).getByText('Draft')).toBeTruthy();
        }
      );
      await scenario(
        'paints the outline the grammar checked: titles at their titleHeading ranks',
        async () => {
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
        }
      );
      await scenario(
        'paints the deck as a document flow: frames, blocks in order, every step visible',
        async () => {
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
        }
      );
      await scenario(
        'is interactive when active and inert when not, at the declared tier',
        async () => {
          const active = await mountFixture();
          expect(
            active.container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')
          ).toBe(false);
          active.unmount();
          const inactive = await mountFixture({ active: false });
          expect(
            inactive.container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')
          ).toBe(true);
          expect(
            inactive.container.querySelector('[data-tx-player-trust]')?.closest('[inert]')
          ).toBeNull();
        }
      );
    }, 150000);
  });
});

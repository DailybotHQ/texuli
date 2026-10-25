import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { frameStops } from '../src/keyboard.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';
import { count, countInput, idTree, loadGolden, paintCore, paintedIds } from './golden-helpers.ts';

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

  it('shows the pinned frame chrome: label and trust badge', async () => {
    const { container } = await mountFixture();
    expect(pinnedFrame.ok).toBe(true);
    const chrome = container.querySelector('.tx-player__chrome') as HTMLElement;
    expect(within(chrome).getByRole('heading', { level: 2 }).textContent).toBe(pinnedFrame.label);
    expect(container.querySelector('[data-tx-player-trust]')?.textContent).toBe(pinnedFrame.badge);
  }, 30_000);

  it('paints the document outline and every block, with no placeholders or node errors', async () => {
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
  }, 30_000);

  it('lists the declared toc: the section headings, as contents links that focus the section', async () => {
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
    expect(within(target).getByRole('heading', { level: 2 }).textContent).toBe('Blocked work');
    expect(container.querySelector('[data-tx-player-surface]')?.contains(target)).toBe(true);
  }, 30_000);
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

  it('Tab visits skip link, contents, chart controls and the source link, in reading order', async () => {
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
  }, 30_000);

  it('chart keys stay with the chart: arrows move its point, its Escape is its own', async () => {
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
  }, 30_000);

  it('the source link walks outward with Escape and F6 reaches the document frame', async () => {
    const { container } = await mountFixture();
    const link = screen.getByRole('link', { name: 'week 42 board export' });
    expect(link.getAttribute('href')).toBe('https://example.com/reports/w42.csv');
    link.focus();
    await fireEvent.keyDown(link, { key: 'Escape', bubbles: true, cancelable: true });
    const doc = frameStops(container)[0];
    expect(document.activeElement).toBe(doc);
    await fireEvent.keyDown(doc as Element, { key: 'Escape', bubbles: true, cancelable: true });
    expect(document.activeElement).toBe(container.querySelector('.tx-player__label'));
    link.focus();
    await fireEvent.keyDown(link, { key: 'F6', bubbles: true, cancelable: true });
    expect(document.activeElement).toBe(doc);
  }, 30_000);

  it('chart controls change only local component state: no host callback, re-validation or network', async () => {
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
  }, 30_000);

  it('an inactive frame takes no focus or input; the trust badge stays visible', async () => {
    const { container } = await mountFixture({ active: false });
    expect(container.querySelector('[data-tx-player-surface]')?.hasAttribute('inert')).toBe(true);
    expect(tabStops(container)).toEqual([`Skip past ${fixtureFrame.label}`]);
    expect(container.querySelector('[data-tx-player-trust]')?.closest('[inert]')).toBeNull();
  }, 30_000);
});

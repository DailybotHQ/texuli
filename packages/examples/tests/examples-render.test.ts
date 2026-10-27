import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { validateComposition } from '@texuli/media';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';
import { harborPoster, hostileScene } from '../src/media-composition-canvas/scenes.ts';

/**
 * Every example that carries a unit check, grouped by package area: each
 * example registers, loads lazily and renders what its page promises. One
 * test per area keeps the environment setup to a single file.
 */

async function load(id: string, component?: string) {
  const entry = getExample(id);
  expect(entry, id).toBeDefined();
  if (component) expect(entry?.component, id).toBe(component);
  const module = await entry?.load();
  if (!module) throw new Error(`${id} example did not load.`);
  return module.default;
}

async function renderExample(id: string, component?: string) {
  cleanup();
  return render(await load(id, component));
}

describe('example renders', () => {
  // The live-region announcers are page singletons: the tests that assert no
  // alert or status run before any example that announces.
  it('player: every example validates at the untrusted tier and paints without node errors', async () => {
    for (const id of ['player-blueprint-preview', 'player-dashboard', 'player-deck']) {
      const { container } = await renderExample(id);
      const root = container.querySelector(`[data-example="${id}"]`);
      await waitFor(() => expect(root?.getAttribute('data-player-surface'), id).toBe('tree'), {
        timeout: 10_000,
      });
      await waitFor(() => expect(screen.queryByText('Loading player…'), id).toBeNull(), {
        timeout: 10_000,
      });
      expect(screen.queryByRole('alert'), id).toBeNull();
      expect(container.querySelector('[data-tx-player-error]'), id).toBeNull();
      expect(screen.getAllByText('Untrusted content').length, id).toBeGreaterThan(0);
    }
  }, 40_000);
  it('layouts-shells: skip links and RTL copy; the RTL drawer stays closed until toggled', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const { container, getByText, getByRole, queryByRole } = await renderExample(
      'layouts-shells',
      'texuli/AppShell'
    );
    expect(container.querySelectorAll('.tx-app-shell__skip')).toHaveLength(2);
    expect(container.querySelectorAll('[data-tx-app-shell-slot="notifications"]')).toHaveLength(2);
    expect(getByText('Wide workspace')).toBeTruthy();
    expect(getByText('RTL shell with drawer')).toBeTruthy();
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    // Let any lazy drawer chunk settle: a drawer opened on mount would move
    // focus into a modal the visitor never asked for and make the page inert.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await tick();
    expect(document.querySelector('[data-tx-layout-drawer]')).toBeNull();
    expect(queryByRole('dialog')).toBeNull();
    expect(queryByRole('status')).toBeNull();
    const toggle = getByRole('button', { name: 'فتح التنقل' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(document.querySelector('[data-tx-layout-drawer]')).not.toBeNull());
  });

  it('astro: hero and doc previews render statically in both themes', async () => {
    const hero = getExample('astro-site-hero');
    expect(hero).toMatchObject({
      title: 'Astro content site hero',
      component: 'astro/sections/Hero',
      tags: expect.arrayContaining(['astro', 'responsive', 'light', 'dark']),
    });
    let { container } = await renderExample('astro-site-hero');
    expect(container.querySelectorAll('[data-tx-mode="light"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-tx-mode="dark"]')).toHaveLength(1);
    expect(container.querySelectorAll('h3')).toHaveLength(2);
    expect(container.querySelectorAll('.features')).toHaveLength(2);
    expect(container.querySelectorAll('a[href="https://example.com/stories"]')).toHaveLength(2);

    expect(getExample('astro-site-doc')).toMatchObject({
      title: 'Astro content site doc',
      component: 'astro/layouts/ContentLayout',
      tags: expect.arrayContaining(['astro', 'docs', 'responsive', 'light', 'dark']),
    });
    ({ container } = await renderExample('astro-site-doc'));
    expect(container.querySelectorAll('[data-tx-mode="light"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-tx-mode="dark"]')).toHaveLength(1);
    expect(container.querySelectorAll('h3')).toHaveLength(2);
    expect(container.querySelectorAll('h4')).toHaveLength(4);
    expect(container.querySelectorAll('a[href="https://example.com/changelog"]')).toHaveLength(2);
  });

  it('charts: every family example paints accessible plots in light and dark', async () => {
    // id → component, plot count (svg[role=img] and their data tables).
    const plots: ReadonlyArray<[string, string | undefined, number]> = [
      ['charts-calendar', undefined, 2],
      ['charts-histogram', undefined, 2],
      ['charts-pack', undefined, 2],
      ['charts-flow', 'charts/flow', 6],
      ['charts-geo', 'charts/geo', 4],
      ['charts-part-whole', 'charts/part-whole', 8],
    ];
    for (const [id, component, count] of plots) {
      expect(getExample(id)?.tags, id).toContain('charts');
      const { container } = await renderExample(id, component);
      if (component) {
        // The family showcases demonstrate both color schemes.
        expect(
          container.querySelectorAll('[data-tx-mode="light"] svg[role="img"]'),
          id
        ).toHaveLength(count / 2);
        expect(
          container.querySelectorAll('[data-tx-mode="dark"] svg[role="img"]'),
          id
        ).toHaveLength(count / 2);
      }
      expect(container.querySelectorAll('svg[role="img"]'), id).toHaveLength(count);
      expect(container.querySelectorAll('details'), id).toHaveLength(count);
      if (id === 'charts-flow') {
        expect(container.querySelectorAll('[data-tx-mode="light"] figure')).toHaveLength(3);
        expect(container.querySelectorAll('[data-tx-mode="dark"] figure')).toHaveLength(3);
      }
    }

    let { container } = await renderExample('charts-statistical');
    expect(container.querySelectorAll('article')).toHaveLength(2);
    for (const title of [
      'Response time spread',
      'Response time density',
      'Share of requests under a time',
    ]) {
      expect(screen.getAllByText(title).length, title).toBeGreaterThanOrEqual(2);
    }

    ({ container } = await renderExample('blocks-data-charts'));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 5000 });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelectorAll('[data-tx-block="chart"]')).toHaveLength(9);
    expect(container.querySelector('.tx-block-chart-loading')).toBeNull();
    for (const title of [
      'Workspaces by plan',
      'Check-in completion',
      'Weekly sign-ups against goal',
    ]) {
      expect(screen.getAllByText(title).length, title).toBeGreaterThan(0);
    }

    // RTL container, LTR plot coordinates.
    ({ container } = await renderExample('charts-rtl'));
    expect(container.querySelector('[data-example="charts-rtl"]')?.getAttribute('dir')).toBe('rtl');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 5000 });
    const svgs = [...container.querySelectorAll('svg[role="img"]')];
    expect(svgs.length).toBeGreaterThanOrEqual(5);
    for (const svg of svgs) expect(svg.getAttribute('direction')).toBe('ltr');

    // The windowed series moves and clamps at its start.
    expect(listExampleIds()).toContain('charts-windowed');
    ({ container } = await renderExample('charts-windowed'));
    const window = () => container.querySelector('[data-window]')?.textContent?.trim();
    expect(window()).toBe('Showing requests 40 to 60');
    await fireEvent.click(screen.getByRole('button', { name: 'Previous window' }));
    expect(window()).toBe('Showing requests 20 to 40');
    await fireEvent.click(screen.getByRole('button', { name: 'Previous window' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Previous window' }));
    expect(window()).toBe('Showing requests 0 to 20');
    await fireEvent.click(screen.getByRole('button', { name: 'Full range' }));
    expect(window()).toBe('Showing requests 0 to 199');
  });

  it('chat: composer, display (hostile markup inert) and a streamed thread', async () => {
    let { container } = await renderExample('chat-composer', 'chat/composer');
    expect(container.querySelector('textarea[aria-describedby]')).not.toBeNull();
    expect(container.querySelector('[role="status"][aria-live="polite"]')?.textContent).toContain(
      'Jordan is typing'
    );
    await waitFor(() =>
      expect(container.querySelector('button[aria-label="Attach a file"]')).not.toBeNull()
    );

    ({ container } = await renderExample('chat-display', 'chat/ChatThreadDisplay'));
    expect(container.querySelectorAll('[data-tx-chat-display-message]')).toHaveLength(3);
    expect(container.querySelector('[data-role="system"]')).not.toBeNull();
    expect(container.querySelectorAll('.tx-chat-mention')).toHaveLength(2);
    expect(container.textContent).toContain('@not-a-known-person.');
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');

    const thread = await renderExample('chat-thread');
    await fireEvent.click(thread.getByRole('button', { name: 'Simulate a streamed reply' }));
    await waitFor(() =>
      expect(thread.getByText('Streamed reply: review is complete.')).toBeTruthy()
    );
  });

  it('editor: every example renders a named multiline textbox and no script', async () => {
    const cases: ReadonlyArray<[string, string, boolean]> = [
      ['editor-basic', 'Release notes', false],
      ['editor-toolbar', 'Weekly update', true],
      ['editor-long-document', 'Team handbook', false],
    ];
    for (const [id, name, toolbar] of cases) {
      expect(getExample(id)?.component.startsWith('editor/'), id).toBe(true);
      const { container, getByRole } = await renderExample(id);
      expect(getByRole('textbox', { name }).getAttribute('aria-multiline'), id).toBe('true');
      expect(container.querySelector('[role="toolbar"]') !== null, id).toBe(toolbar);
      if (id === 'editor-toolbar') {
        expect(container.querySelector('.narrow-rtl[dir="rtl"]')).not.toBeNull();
      }
      if (id === 'editor-long-document') {
        expect(container.querySelectorAll('.tx-editor-surface > *').length).toBe(400);
      }
      expect(container.querySelector('script, [onclick], [onerror]'), id).toBeNull();
    }
  });

  it('media: timeline, video edit and the composition examples', async () => {
    const timeline = await renderExample('media-animation-timeline', 'media/AnimationTimeline');
    await waitFor(() =>
      expect(
        timeline.container.querySelector('[data-tx-timeline-row="lower-third"]')
      ).not.toBeNull()
    );
    const keyframe = timeline.container.querySelector<HTMLButtonElement>(
      '[data-tx-timeline-keyframe="lower-third:1"]'
    );
    if (!keyframe) throw new Error('Lower-third keyframe did not render.');
    await fireEvent.click(keyframe);
    expect(keyframe.getAttribute('aria-pressed')).toBe('true');
    expect(timeline.getByText('Lower-third · 6 seconds')).toBeTruthy();
    expect(timeline.container.querySelector('[dir="rtl"]')).not.toBeNull();

    const video = await renderExample('media-video-edit', 'media/VideoEditPanel');
    expect(video.getByText('Port Meridian field note · 10 seconds')).toBeTruthy();
    expect(video.getByLabelText('Caption text 1')).toBeTruthy();
    await waitFor(() =>
      expect(video.container.querySelector('textarea')?.value).toBe(
        'A calm morning at Port Meridian.'
      )
    );
    expect(video.container.querySelectorAll('input[type="number"]')).toHaveLength(6);

    for (const [id, component, tags] of [
      ['media-composition-canvas', 'media/CompositionCanvas', ['media', 'canvas', 'keyboard']],
      ['media-composition-model', 'media/compositionModel', ['media', 'composition']],
    ] as const) {
      expect(getExample(id)?.tags, id).toEqual(expect.arrayContaining([...tags]));
      expect(await load(id, component), id).toBeTypeOf('function');
    }
    const poster = validateComposition(harborPoster);
    expect(poster.ok).toBe(true);
    if (poster.ok) expect(poster.composition.layers).toHaveLength(168);
    const hostile = validateComposition(hostileScene);
    expect(hostile.ok).toBe(false);
    if (!hostile.ok) expect(hostile.errors.map((issue) => issue.code)).toContain('unsafe-source');
  });

  it('data and texuli: board, grid, map, button, table, field, feedback, alert and toast', async () => {
    const board = await renderExample('data-board');
    expect(board.container.querySelector('section.demo')?.getAttribute('dir')).toBe('ltr');
    expect(board.getByRole('heading', { name: 'Right-to-left preview' })).toBeTruthy();
    expect(board.container.querySelector('.rtl-preview .tx-board')?.getAttribute('dir')).toBe(
      'rtl'
    );

    const text = await renderExample('blocks-text');
    expect(text.container.textContent).toContain('A new workspace accent');
    expect(text.container.textContent).toContain('Access paused');
    expect(text.container.querySelector('[data-tone="danger"]')).not.toBeNull();
    const code = await renderExample('blocks-code');
    expect(code.container.textContent).toContain('deliberately long line demonstrates');

    const grid = await renderExample('data-grid-core');
    expect(grid.getByText('Windowed rows')).toBeTruthy();
    expect(
      grid.getByText('80 fictional rows with virtualization enabled after 20 visible records.')
    ).toBeTruthy();
    const map = await renderExample('data-map');
    expect(map.container.querySelector('[dir="rtl"][lang="ar"]')).not.toBeNull();
    expect(map.container.textContent).toContain('تغطية الميناء');

    const button = await renderExample('texuli-button');
    expect(button.getByRole('button', { name: 'More actions, large' })).toBeTruthy();
    expect(button.container.querySelector('[data-axis="group-vertical"]')).not.toBeNull();
    const darkScope = button.container.querySelector<HTMLElement>('[data-axis="dark"]');
    expect(darkScope?.dataset.txMode).toBe('dark');
    await waitFor(() => expect(darkScope?.style.getPropertyValue('--tx-primary')).not.toBe(''));

    const table = await renderExample('texuli-table');
    expect(table.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    const field = await renderExample('texuli-field');
    expect(field.getByLabelText('Workspace slug')).toHaveProperty('disabled', true);
    const rtlField = field.container.querySelector<HTMLElement>('[dir="rtl"]');
    expect(rtlField?.getAttribute('lang')).toBe('ar');
    expect(rtlField?.textContent).toContain('اتجاه القراءة');

    const feedback = await renderExample('texuli-feedback');
    expect(feedback.getByLabelText('Loading project summary')).toBeTruthy();
    await fireEvent.click(feedback.getByRole('button', { name: 'Load summary' }));
    await waitFor(() => expect(feedback.getByLabelText('Loaded project summary')).toBeTruthy());
    const alert = await renderExample('texuli-alert');
    expect(
      alert.container.querySelector('[data-tx-layout="callout"][data-tx-tone="success"]')
    ).not.toBeNull();
    const toast = await renderExample('texuli-toast');
    await fireEvent.click(toast.getByRole('button', { name: 'Show all tones' }));
    await waitFor(() =>
      expect(toast.container.textContent).toContain(
        'A very long notification title that remains readable in a narrow notification corner'
      )
    );
  });
});

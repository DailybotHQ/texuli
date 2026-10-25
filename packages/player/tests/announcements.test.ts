import { render, screen, waitFor } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAnnouncer,
  formatAnnouncement,
  paintAnnouncement,
  selectionAnnouncement,
} from '../src/announcements.ts';
import { DEFAULT_PLAYER_LABELS } from '../src/labels.ts';
import { mountPlayer } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
const loaders = { 'layout-page': layoutLoader, 'layout-card': layoutLoader };
const page = (children: unknown[] = [], props: Record<string, unknown> = { title: 'Page' }) => ({
  id: 'layout-page',
  props,
  children,
});
const card = (title: string) => ({ id: 'layout-card', props: { title } });

function announcer(container: Element): string {
  return container.querySelector('[data-tx-player-announcer]')?.textContent?.trim() ?? '';
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('announcements model', () => {
  it('fills localized templates and leaves unknown slots alone', () => {
    expect(formatAnnouncement('{count} of {total}', { count: 2 })).toBe('2 of {total}');
  });

  it('builds one polite paint message from its parts', () => {
    const labels = DEFAULT_PLAYER_LABELS;
    expect(
      paintAnnouncement({ frames: 3, placeholders: 0, preview: false, status: null }, labels)
    ).toBe('Content ready: 3 sections.');
    expect(
      paintAnnouncement({ frames: 1, placeholders: 2, preview: true, status: 'Active' }, labels)
    ).toBe(
      `Content ready: 1 sections. 2 parts could not be shown. ${labels.previewWarning} Status: Active.`
    );
  });

  it('names one selected frame, counts several, and accepts the plain-word label', () => {
    const labels = DEFAULT_PLAYER_LABELS;
    expect(selectionAnnouncement([], labels)).toBe('');
    expect(selectionAnnouncement(['Revenue'], labels)).toBe('Revenue selected');
    expect(selectionAnnouncement(['A', 'B'], labels)).toBe('2 selected');
    expect(selectionAnnouncement(['A', 'B'], { ...labels, selected: 'seleccionados' })).toBe(
      '2 seleccionados'
    );
  });

  it('dedupes per channel until reset', () => {
    const a = createAnnouncer();
    expect(a.announce({ politeness: 'polite', text: 'One' })).toBe('One');
    expect(a.announce({ politeness: 'polite', text: 'One' })).toBeNull();
    expect(a.announce({ politeness: 'assertive', text: 'One' })).toBe('One');
    expect(a.announce({ politeness: 'polite', text: '' })).toBeNull();
    a.reset('polite');
    expect(a.announce({ politeness: 'polite', text: 'One' })).toBe('One');
  });
});

describe('the player speaks through one polite region', () => {
  it('has exactly one live region; badge, skeleton and preview warning are not live', async () => {
    let release: (value: unknown) => void = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const { container } = render(Player, {
      props: {
        blueprint: page([card('Pending')]),
        invalidPolicy: 'preview',
        loaders: { 'layout-page': layoutLoader, 'layout-card': () => gate },
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Page' }, { timeout: 5000 });
    expect(container.querySelector('[data-tx-player-skeleton]')).not.toBeNull();
    const live = Array.from(
      container.querySelectorAll('[aria-live], [role="status"], [role="alert"]')
    );
    expect(live).toEqual([container.querySelector('[data-tx-player-announcer]')]);
    expect(live[0]?.getAttribute('aria-live')).toBe('polite');
    expect(live[0]?.getAttribute('aria-atomic')).toBe('true');
    // Nothing is spoken while a node still loads.
    expect(announcer(container)).toBe('');
    release(await layoutLoader());
    await waitFor(() => expect(announcer(container)).toBe('Content ready: 2 sections.'));
  });

  it('announces unresolved placeholders, the preview warning and a non-draft status', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: page([{ id: 'not-a-component', props: {} }]),
        invalidPolicy: 'preview',
        status: 'active',
        loaders,
      },
    });
    await waitFor(() =>
      expect(announcer(container)).toBe(
        `Content ready: 1 sections. 1 parts could not be shown. ${DEFAULT_PLAYER_LABELS.previewWarning}`
      )
    );
    // An invalid draft shows "Invalid draft", not the host status, so no status part.
    render(Player, { props: { blueprint: page(), status: 'active', loaders } });
    await waitFor(() =>
      expect(
        Array.from(document.querySelectorAll('[data-tx-player-announcer]'))
          .at(-1)
          ?.textContent?.trim()
      ).toBe('Content ready: 1 sections. Status: Active.')
    );
  });

  it('leaves a refusal to the notice: one assertive alert, a silent polite region', async () => {
    const { container } = render(Player, {
      props: { blueprint: { id: 'layout-doc', props: { href: 'javascript:alert(1)' } }, loaders },
    });
    await tick();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(announcer(container)).toBe('');
  });

  it('says nothing again when a state update repaints the same structure', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const mounted = mountPlayer(target, {
      blueprint: {
        format: LOCAL_STATE_FORMAT,
        version: 1,
        state: { title: { type: 'string', initial: 'First' } },
        blueprint: page([card('Card')], { title: { $state: 'title' } }),
      },
      loaders,
    });
    await waitFor(() => expect(announcer(target)).toBe('Content ready: 2 sections.'));
    const region = target.querySelector('[data-tx-player-announcer]') as HTMLElement;
    const changes: MutationRecord[] = [];
    const observer = new MutationObserver((records) => changes.push(...records));
    observer.observe(region, { childList: true, characterData: true, subtree: true });
    mounted.setState('title', 'Second');
    flushSync();
    await tick();
    expect(await screen.findByRole('heading', { level: 1, name: 'Second' })).toBeTruthy();
    expect(changes).toEqual([]);
    observer.disconnect();
    mounted.dispose();
  });

  it('speaks again after a refusal clears, even with the same text', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const mounted = mountPlayer(target, {
      blueprint: {
        format: LOCAL_STATE_FORMAT,
        version: 1,
        state: { note: { type: 'string', initial: 'Fine' } },
        blueprint: page([], { title: 'Page', description: { $state: 'note' } }),
      },
      loaders,
    });
    await waitFor(() => expect(announcer(target)).toBe('Content ready: 1 sections.'));
    mounted.setState('note', '<b>refused</b>');
    flushSync();
    await tick();
    expect(announcer(target)).toBe('');
    expect(target.querySelector('[role="alert"]')).not.toBeNull();
    mounted.setState('note', 'Fine again');
    flushSync();
    await waitFor(() => expect(announcer(target)).toBe('Content ready: 1 sections.'));
    mounted.dispose();
  });

  it('uses the host’s localized templates', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: page([card('Uno')]),
        loaders,
        labels: { painted: 'Contenido listo: {frames} secciones.' },
      },
    });
    await waitFor(() => expect(announcer(container)).toBe('Contenido listo: 2 secciones.'));
  });
});

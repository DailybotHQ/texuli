import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { validateCatalogManifests } from '@texuli/catalog/manifest';
import { validateDraft } from '@texuli/catalog/validate';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { frameStops } from '../src/keyboard.ts';
import { G20_LAYOUT_MANIFESTS, PLAYER_GRAMMAR_ROLES } from '../src/layout-manifests.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';

const card = (title: string) => ({ id: 'layout-card', props: { title } });

/** A dashboard built only from the G20 vocabulary plus cards. */
const dashboard = {
  id: 'layout-page',
  props: { title: 'Fictional operations' },
  children: [
    {
      id: 'layout-stack',
      props: { gap: 'small' },
      children: [
        {
          id: 'layout-row',
          props: { gap: 'small', align: 'center' },
          children: [card('Opened'), card('Solved')],
        },
        {
          id: 'layout-split',
          props: { ratio: '2:1', gap: 'large' },
          children: [card('Trend'), card('Notes')],
        },
      ],
    },
    {
      id: 'layout-grid',
      props: { columns: 3 },
      children: [
        { id: 'layout-tile', props: { title: 'Wide tile', span: 2, rowSpan: 2 } },
        { id: 'layout-tile', props: { title: 'Small tile' } },
      ],
    },
  ],
};

async function paint(blueprint: unknown, extra: Record<string, unknown> = {}) {
  const view = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS, ...extra } });
  await screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
  await waitFor(
    () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
    {
      timeout: 5000,
    }
  );
  await tick();
  return view;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('G20 layout vocabulary', () => {
  it('ships valid, agent-emittable manifests and grammar roles', () => {
    expect(validateCatalogManifests(G20_LAYOUT_MANIFESTS)).toMatchObject({ valid: true });
    const catalog = createPlayerCatalog();
    for (const id of ['layout-stack', 'layout-row', 'layout-split', 'layout-tile']) {
      expect(catalog.allows?.(id, 'untrusted')).toBe(true);
      expect(PLAYER_GRAMMAR_ROLES.get(id)?.role).toBe('container');
    }
    expect(PLAYER_GRAMMAR_ROLES.get('layout-tile')?.titleHeading).toBe('nested');
  });

  it('validates a G20 dashboard under the untrusted tier with no grammar issues', () => {
    const validation = validateDraft(dashboard, {
      catalog: createPlayerCatalog(),
      tier: 'untrusted',
      roles: PLAYER_GRAMMAR_ROLES,
    });
    expect(validation.ok).toBe(true);
    expect(validation.diagnostics).toEqual([]);
  });

  it('paints each layout with closed tokens and keeps reading order', async () => {
    const { container } = await paint(dashboard);
    const stack = container.querySelector('.tx-player-layout--stack');
    const row = container.querySelector('.tx-player-layout--row');
    const split = container.querySelector('.tx-player-layout--split');
    expect(stack?.getAttribute('data-gap')).toBe('small');
    expect(row?.getAttribute('data-align')).toBe('center');
    expect(row?.getAttribute('data-wrap')).toBe('true');
    expect(split?.getAttribute('data-ratio')).toBe('2:1');
    expect(split?.getAttribute('data-gap')).toBe('large');
    for (const element of [stack, row, split]) expect(element?.hasAttribute('style')).toBe(false);
    // DOM order is the tree order (no visual reordering).
    const titles = Array.from(container.querySelectorAll('.tx-player-layout__title')).map(
      (h) => h.textContent
    );
    expect(titles).toEqual([
      'Fictional operations',
      'Opened',
      'Solved',
      'Trend',
      'Notes',
      'Wide tile',
      'Small tile',
    ]);
  });

  it('ranks tile titles like cards and spans tiles with clamped integers', async () => {
    const { container } = await paint(dashboard);
    expect(screen.getByRole('heading', { level: 2, name: 'Wide tile' })).toBeTruthy();
    const tiles = container.querySelectorAll<HTMLElement>('.tx-player-layout--tile');
    expect(tiles[0]?.getAttribute('style')?.replace(/;\s*$/, '')).toBe(
      '--tx-player-span: 2; --tx-player-row-span: 2'
    );
    expect(tiles[1]?.getAttribute('style')?.replace(/;\s*$/, '')).toBe(
      '--tx-player-span: 1; --tx-player-row-span: 1'
    );
  });

  it('clamps out-of-range spans and refuses free-text tokens', async () => {
    const { container } = await paint({
      id: 'layout-page',
      props: { title: 'Clamp' },
      children: [
        {
          id: 'layout-grid',
          props: { columns: 2 },
          children: [
            { id: 'layout-tile', props: { title: 'Huge', span: 1e9, rowSpan: 9 } },
            { id: 'layout-tile', props: { title: 'Negative', span: -3, rowSpan: 0.5 } },
          ],
        },
      ],
    });
    const tiles = container.querySelectorAll<HTMLElement>('.tx-player-layout--tile');
    expect(tiles[0]?.getAttribute('style')?.replace(/;\s*$/, '')).toBe(
      '--tx-player-span: 4; --tx-player-row-span: 2'
    );
    expect(tiles[1]?.getAttribute('style')?.replace(/;\s*$/, '')).toBe(
      '--tx-player-span: 1; --tx-player-row-span: 1'
    );

    const hostile = validateDraft(
      {
        id: 'layout-page',
        props: { title: 'Hostile' },
        children: [
          { id: 'layout-stack', props: { gap: '1rem; background:url(javascript:alert(1))' } },
        ],
      },
      { catalog: createPlayerCatalog(), tier: 'untrusted', roles: PLAYER_GRAMMAR_ROLES }
    );
    expect(hostile.ok).toBe(false);
  });

  it('makes every G20 layout a frame stop that the roving and selection models use', async () => {
    const { container } = await paint(dashboard, { selectable: true });
    const classes = frameStops(container).map((frame) => frame.className.match(/--(\w+)/)?.[1]);
    expect(classes).toEqual([
      'page',
      'stack',
      'row',
      'card',
      'card',
      'split',
      'card',
      'card',
      'grid',
      'tile',
      'tile',
    ]);
    const row = container.querySelector<HTMLElement>('.tx-player-layout--row') as HTMLElement;
    row.focus();
    await fireEvent.keyDown(row, { key: 'ArrowDown', bubbles: true, cancelable: true });
    expect(document.activeElement?.classList.contains('tx-player-layout--split')).toBe(true);
    await fireEvent.click(container.querySelector('.tx-player-layout--tile') as HTMLElement);
    expect(
      container.querySelector('.tx-player-layout--tile')?.hasAttribute('data-tx-player-selected')
    ).toBe(true);
  });
});

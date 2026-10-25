import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';

const blueprint = { id: 'layout-page', props: { title: 'Thread artifact' } };

/** Paint the layout-page blueprint and wait until every painter has loaded. */
async function paint(extra: object = {}) {
  const view = render(Player, {
    props: { blueprint, tier: 'developer', loaders: PLAYER_LOADERS, ...extra },
  });
  await screen.findAllByRole('heading', { level: 1 }, { timeout: 5000 });
  await waitFor(
    () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
    { timeout: 5000 }
  );
  await tick();
  return view;
}

afterEach(cleanup);

describe('player landmark ownership', () => {
  it('paints the page layout as main by default (standalone document)', async () => {
    const { container } = await paint();
    // A standalone document has no host main, so the page layout owns it.
    expect(container.querySelector('main.tx-player-layout--page')).not.toBeNull();
    expect(container.querySelector('section.tx-player-layout--page')).toBeNull();
  });

  it('paints a section instead when the host owns the landmark (landmarks={false})', async () => {
    const { container } = await paint({ landmarks: false });
    // Embedded players must never claim a second main: the /builder/ page
    // fails the duplicate-main axe rule otherwise.
    expect(container.querySelector('section.tx-player-layout--page')).not.toBeNull();
    expect(container.querySelector('main')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('Thread artifact');
  });
});

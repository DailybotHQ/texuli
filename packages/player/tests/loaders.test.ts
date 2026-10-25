import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import Player from '../src/Player.svelte';
import { skeletonFamily, withLoadTimeout } from '../src/skeletons.ts';

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('skeletonFamily', () => {
  it('maps catalog id prefixes to skeleton shapes', () => {
    expect(skeletonFamily('layout-doc')).toBe('layout');
    expect(skeletonFamily('blocks-text')).toBe('block');
    expect(skeletonFamily('charts-bar')).toBe('chart');
    expect(skeletonFamily('media-image')).toBe('media');
    expect(skeletonFamily('something-else')).toBe('generic');
  });
});

describe('withLoadTimeout', () => {
  it('rejects a load that never settles once the timeout passes', async () => {
    vi.useFakeTimers();
    try {
      const loaders = withLoadTimeout({ slow: () => new Promise(() => {}) }, 50);
      const result = loaders.slow?.();
      const settled = expect(result).rejects.toThrow(/timed out after 50 ms/);
      await vi.advanceTimersByTimeAsync(60);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes resolved values and rejections through, and keeps loaders when disabled', async () => {
    const loaders = { ok: async () => 'value', bad: async () => Promise.reject(new Error('no')) };
    const wrapped = withLoadTimeout(loaders, 1000);
    await expect(wrapped.ok?.()).resolves.toBe('value');
    await expect(wrapped.bad?.()).rejects.toThrow('no');
    expect(withLoadTimeout(loaders, 0)).toBe(loaders);
    expect(withLoadTimeout(loaders, Number.POSITIVE_INFINITY)).toBe(loaders);
  });
});

describe('Player lazy loaders', () => {
  it('shows a labelled family skeleton while a node loads, then the component', async () => {
    const gate = deferred<unknown>();
    const { container } = render(Player, {
      props: {
        blueprint: {
          id: 'layout-doc',
          props: { title: 'Fictional report' },
          children: [
            { id: 'blocks-text', props: { block: { type: 'text', markdown: 'Loaded text.' } } },
          ],
        },
        loaders: {
          'layout-doc': layoutLoader,
          'blocks-text': () => gate.promise,
        },
      },
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Fictional report' })).toBeTruthy();
    const skeleton = container.querySelector('[data-tx-player-skeleton="blocks-text"]');
    expect(skeleton?.getAttribute('data-family')).toBe('block');
    expect(skeleton?.getAttribute('aria-busy')).toBe('true');
    // Not a live region: the player's one announcer speaks once the paint settles.
    expect(skeleton?.hasAttribute('role')).toBe(false);
    expect(skeleton?.textContent).toMatch(/Loading .+…/);

    gate.resolve(await PLAYER_LOADERS['blocks-text']?.());
    expect(await screen.findByText('Loaded text.')).toBeTruthy();
    expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull();
  });

  it('only calls the loaders for the ids the blueprint paints', async () => {
    const used = vi.fn(layoutLoader);
    const unused = vi.fn(layoutLoader);
    render(Player, {
      props: {
        blueprint: { id: 'layout-page', props: { title: 'Lazy page' } },
        loaders: { 'layout-page': used, 'layout-doc': unused },
      },
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Lazy page' })).toBeTruthy();
    expect(used).toHaveBeenCalledTimes(1);
    expect(unused).not.toHaveBeenCalled();
  });

  it('replaces a skeleton that outlives loadTimeoutMs with an error placeholder', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: { id: 'layout-page', props: { title: 'Never loads' } },
        loaders: { 'layout-page': () => new Promise(() => {}) },
        loadTimeoutMs: 20,
      },
    });

    expect(container.querySelector('[data-tx-player-skeleton="layout-page"]')).toBeTruthy();
    expect(await screen.findByText('“layout-page” could not be shown')).toBeTruthy();
    expect(container.querySelector('[data-tx-player-skeleton]')).toBeNull();
  });
});

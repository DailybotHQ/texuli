import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';

afterEach(cleanup);

const IDS = ['player-blueprint-preview', 'player-dashboard', 'player-deck'] as const;

describe('player examples', () => {
  it('registers a blueprint preview, a dashboard and a deck view', () => {
    expect(listExampleIds()).toEqual(expect.arrayContaining([...IDS]));
  });

  it.each(IDS)(
    '%s validates at the untrusted tier and paints without node errors',
    async (id) => {
      const module = await getExample(id)?.load();
      if (!module) throw new Error(`${id} example did not load.`);
      const { container } = render(module.default);
      const root = container.querySelector(`[data-example="${id}"]`);
      await waitFor(() => expect(root?.getAttribute('data-player-surface')).toBe('tree'), {
        timeout: 10_000,
      });
      await waitFor(() => expect(screen.queryByText('Loading player…')).toBeNull(), {
        timeout: 10_000,
      });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(container.querySelector('[data-tx-player-error]')).toBeNull();
      expect(screen.getAllByText('Untrusted content').length).toBeGreaterThan(0);
    },
    20_000
  );
});

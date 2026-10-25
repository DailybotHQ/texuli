import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';

afterEach(cleanup);

describe('math-backed chart examples', () => {
  it('registers stable lazy example ids for histogram, pack and calendar', async () => {
    const ids = ['charts-calendar', 'charts-histogram', 'charts-pack'] as const;
    expect(listExampleIds()).toEqual(expect.arrayContaining([...ids]));

    for (const id of ids) {
      const entry = getExample(id);
      expect(entry?.tags).toContain('charts');
      const module = await entry?.load();
      expect(module).toBeDefined();
      if (!module) throw new Error(`${id} example did not load.`);
      const { container, unmount } = render(module.default);
      expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(2);
      expect(container.querySelectorAll('details')).toHaveLength(2);
      unmount();
    }
  });
});

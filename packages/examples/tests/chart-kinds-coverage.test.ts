import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample, listExampleIds } from '../src/index.ts';

afterEach(cleanup);

async function renderExample(id: string) {
  const entry = getExample(id);
  expect(entry?.tags).toContain('charts');
  const module = await entry?.load();
  if (!module) throw new Error(`${id} example did not load.`);
  return render(module.default);
}

describe('chart kind examples', () => {
  it('registers the statistical and chart block examples', () => {
    expect(listExampleIds()).toEqual(
      expect.arrayContaining(['charts-statistical', 'blocks-data-charts'])
    );
  });

  it('renders box, violin and ECDF charts in light and dark panels', async () => {
    const { container } = await renderExample('charts-statistical');
    expect(container.querySelectorAll('article')).toHaveLength(2);
    for (const title of [
      'Response time spread',
      'Response time density',
      'Share of requests under a time',
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('renders every chart block and clears its loading status', async () => {
    const { container } = await renderExample('blocks-data-charts');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 5000 });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelectorAll('[data-tx-block="chart"]')).toHaveLength(9);
    expect(container.querySelector('.tx-block-chart-loading')).toBeNull();
    for (const title of [
      'Workspaces by plan',
      'Check-in completion',
      'Weekly sign-ups against goal',
    ]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });
});

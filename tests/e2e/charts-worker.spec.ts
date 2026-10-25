import { expect, test } from '@playwright/test';

/*
 * A real module Worker loaded with the documented host pattern
 * (`new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), { type: 'module' })`)
 * must return exactly the synchronous bin, LTTB and min-max results, and a
 * worker constructor that throws must fall back to the main thread.
 */

interface RunResult {
  mode: 'worker' | 'main-thread';
  answers: number;
  bins: boolean;
  lttb: boolean;
  minMax: boolean;
  binCount: number;
}

test('chart offload runs in a real worker and falls back when workers are blocked', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/worker.html');
  await expect(page.locator('#status')).toHaveText('Done', { timeout: 30_000 });
  const result = await page.evaluate(
    () =>
      (window as unknown as { __chartWorker: { worker: RunResult; fallback: RunResult } })
        .__chartWorker
  );

  // The real worker answered all three requests and never failed over.
  expect(result.worker).toMatchObject({
    mode: 'worker',
    answers: 3,
    bins: true,
    lttb: true,
    minMax: true,
  });
  expect(result.worker.binCount).toBeGreaterThan(1);
  // A throwing constructor (SSR, CSP) still yields identical results on the main thread.
  expect(result.fallback).toMatchObject({
    mode: 'main-thread',
    answers: 0,
    bins: true,
    lttb: true,
    minMax: true,
  });
  expect(errors).toEqual([]);
});

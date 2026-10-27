import { expect, type Page } from '@playwright/test';
import { markerFor } from '../../../apps/website/src/components/live/markers.ts';

/**
 * A component page's live stage (`/component-pages/<id>/`) has mounted its
 * real component: the stage is visible and ready, its marker part is on
 * screen with a size, and its declared interaction (if any) is pressed.
 */
export async function expectLiveStage(page: Page, id: string): Promise<void> {
  const stage = page.locator(`[data-tx-live-stage="${id}"]`).first();
  await expect(stage, id).toBeVisible({ timeout: 25_000 });
  await expect(stage, id).toHaveAttribute('data-tx-live-ready', 'true', { timeout: 25_000 });
  const box = await stage.boundingBox();
  expect(box, `stage ${id} size`).toBeTruthy();
  expect((box?.width ?? 0) * (box?.height ?? 0), id).toBeGreaterThan(0);

  const spec = markerFor(id);
  const marker = stage.locator(spec.marker).first();
  await expect(marker, `marker for ${id}: ${spec.marker}`).toBeVisible({ timeout: 20_000 });
  const mBox = await marker.boundingBox();
  expect((mBox?.width ?? 0) * (mBox?.height ?? 0), id).toBeGreaterThan(0);

  if (spec.interact) {
    const control = stage.locator(spec.interact).first();
    if ((await control.count()) > 0 && (await control.isVisible().catch(() => false))) {
      await control.click({ timeout: 5_000 }).catch(() => undefined);
    }
  }
}

/** Every request a page makes to another origin while `action` runs. */
export async function foreignRequests(
  page: Page,
  origin: string,
  action: () => Promise<unknown>
): Promise<string[]> {
  const foreign: string[] = [];
  const onRequest = (request: { url: () => string }) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  };
  page.on('request', onRequest);
  try {
    await action();
  } finally {
    page.off('request', onRequest);
  }
  return foreign;
}

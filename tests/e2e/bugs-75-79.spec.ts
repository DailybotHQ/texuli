import { expect, type Page, test } from '@playwright/test';

/*
 * T-bugs-75-79: the five bugs from the Protoyard E2E sweep on 0.5.0, on the
 * fixture page tests/fixtures/app/bugs-75-79.html (one `?case=` each).
 *
 * G75 an overlay opened inside a top-layer modal Dialog stays above the
 *     dialog backdrop: a Select option and a Popover button take the pointer.
 * G76 a 4-column board does not widen a 390 px page.
 * G77 an empty Toaster puts nothing in the top layer; a contained Toaster
 *     stays inside its framed preview.
 * G78 under reduced motion, a container turning visible shows its nested
 *     content in the same frame (0s durations and delays).
 * G79 with a host `[hidden] { display: none !important }`, the lazy avatar
 *     image still loads and replaces the initials.
 */

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/bugs-75-79.html?${query}`);
  await expect(page.locator('#app > *').first()).toBeVisible({ timeout: 30_000 });
}

/** Whether the element on top at the center of `selector` is it (or inside it). */
async function onTop(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && (hit === node || node.contains(hit));
  });
}

test('G75: a Select and a Popover opened inside a modal Dialog take the pointer above its backdrop', async ({
  page,
}) => {
  await open(page, 'case=dialog-select');
  await page.getByRole('button', { name: 'Open booking' }).click();
  const dialog = page.getByRole('dialog', { name: 'Room booking' });
  await expect(dialog).toBeVisible();
  // The dialog itself is above its backdrop.
  await expect.poll(() => onTop(page, '[role="dialog"]')).toBe(true);

  await dialog.getByRole('combobox', { name: 'Room' }).click();
  const option = page.getByRole('option', { name: 'Lighthouse room' });
  await expect(option).toBeVisible();
  // The listbox is the topmost layer at the option, not the re-shown backdrop.
  expect(await onTop(page, '[role="option"]:has-text("Lighthouse room")')).toBe(true);
  // A pointer pick (Playwright refuses a click another element intercepts).
  await option.click({ timeout: 5000 });
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#g75-room')).toHaveText('lighthouse');
  // After the Select closed, the dialog is still on top of the backdrop.
  expect(await onTop(page, '[role="dialog"]')).toBe(true);

  // A Popover opened inside the dialog takes the pointer too.
  await dialog.getByRole('button', { name: 'Room rules' }).click();
  const ack = page.locator('#rules-ack');
  await expect(ack).toBeVisible();
  expect(await onTop(page, '#rules-ack')).toBe(true);
  await ack.click({ timeout: 5000 });
  await expect(dialog).toBeVisible();

  // The Select opens again above the dialog after the popover was raised.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Room rules' })).toBeHidden();
  await dialog.getByRole('combobox', { name: 'Room' }).click();
  await page.getByRole('option', { name: 'Dock room' }).click({ timeout: 5000 });
  await expect(page.locator('#g75-room')).toHaveText('dock');
});

test('G76: a 4-column board does not widen a 390 px page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'case=board');
  await expect(page.getByRole('list', { name: 'Done' })).toBeAttached();
  const widths = await page.evaluate(() => ({
    scroll: (document.scrollingElement ?? document.documentElement).scrollWidth,
    viewport: window.innerWidth,
    board: document.querySelector('[data-board-scroller]')?.scrollWidth ?? 0,
  }));
  // The board itself scrolls sideways; the page does not.
  expect(widths.board).toBeGreaterThan(widths.viewport);
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
});

test('G77: an empty Toaster puts nothing in the top layer; a contained one stays in its frame', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'case=toaster');
  const openRegions = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll('[data-tx-toast-viewport]')].filter((node) =>
          node.matches(':popover-open')
        ).length
    );
  // Empty: no top-layer viewport anywhere, nothing visible at the page corner.
  expect(await openRegions()).toBe(0);
  await expect(page.getByRole('region', { name: 'Page notifications' })).toBeHidden();

  // Contained: the region renders inside the frame, out of the top layer.
  await page.evaluate(() =>
    (window as unknown as { txBugs: { frameToast(title: string): void } }).txBugs.frameToast(
      'Draft saved'
    )
  );
  const preview = page.getByRole('region', { name: 'Preview notifications' });
  await expect(preview.getByText('Draft saved')).toBeVisible();
  expect(await openRegions()).toBe(0);
  expect(
    await preview.evaluate((node) => node.parentElement?.hasAttribute('data-frame') === true)
  ).toBe(true);
  const frameBox = await page.locator('[data-frame]').boundingBox();
  const toastBox = await preview.locator('[data-tx-toast-root]').boundingBox();
  if (!frameBox || !toastBox) throw new Error('frame or toast not rendered');
  expect(toastBox.x).toBeGreaterThanOrEqual(frameBox.x);
  expect(toastBox.y).toBeGreaterThanOrEqual(frameBox.y);
  expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(frameBox.x + frameBox.width + 0.5);
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 0.5);
  expect(await onTop(page, '[data-frame] [data-tx-toast-root]')).toBe(true);

  // Top layer: shown while it has a toast, gone again once it empties.
  await page.evaluate(() =>
    (window as unknown as { txBugs: { pageToast(title: string): void } }).txBugs.pageToast(
      'Profile saved'
    )
  );
  const pageRegion = page.getByRole('region', { name: 'Page notifications' });
  await expect(pageRegion.getByText('Profile saved')).toBeVisible();
  expect(await openRegions()).toBe(1);
  await page.evaluate(() => (window as unknown as { txBugs: { clear(): void } }).txBugs.clear());
  await expect.poll(openRegions).toBe(0);
  await expect(pageRegion).toBeHidden();
});

test.describe('G78: reduced motion reveals nested content in the same frame', () => {
  const reveal = (page: Page) =>
    page.evaluate(() => {
      const container = document.querySelector<HTMLElement>('[data-reveal]');
      const deep = document.getElementById('deep-action');
      if (!container || !deep) throw new Error('reveal case not rendered');
      container.dataset.open = 'true';
      // Same frame: read right after the style change, before any paint.
      return getComputedStyle(deep).visibility;
    });

  test('with prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'case=reveal');
    expect(await reveal(page)).toBe('visible');
    await expect(page.getByRole('button', { name: 'Deep action' })).toBeVisible();
  });

  test('with data-tx-motion="reduce"', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page, 'case=reveal&motion=attr');
    expect(await reveal(page)).toBe('visible');
  });

  test('control: with full motion the reveal is a transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page, 'case=reveal');
    expect(await reveal(page)).toBe('hidden');
    await expect(page.getByRole('button', { name: 'Deep action' })).toBeVisible();
  });
});

test('G79: the lazy avatar image loads under a host [hidden] { display: none !important }', async ({
  page,
}) => {
  // A fictional host; the 1×1 PNG is served by the test.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  let requested = 0;
  await page.route('https://avatars.example/**', (route) => {
    requested += 1;
    return route.fulfill({ status: 200, contentType: 'image/png', body: png });
  });
  await open(page, 'case=avatar&hidden-rule=1');
  // The host rule is in effect on the page.
  expect(
    await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.hidden = true;
      probe.style.display = 'block';
      document.body.append(probe);
      const display = getComputedStyle(probe).display;
      probe.remove();
      return display;
    })
  ).toBe('none');
  const image = page.locator('[data-tx-avatar-image]');
  await expect(image).toHaveAttribute('data-state', 'loaded', { timeout: 10_000 });
  expect(requested).toBeGreaterThan(0);
  expect(await image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(1);
  await expect(page.locator('[data-tx-avatar-fallback]')).toHaveCount(0);
  // One accessible name, on the avatar root; the image adds none.
  await expect(page.getByRole('img', { name: 'Ada Example' })).toHaveCount(1);
  await expect(image).toBeVisible();
});

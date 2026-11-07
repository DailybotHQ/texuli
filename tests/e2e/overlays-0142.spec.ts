import { expect, type Page, test } from '@playwright/test';

/*
 * 0.14.2 overlay and toggle fixes, on tests/fixtures/app/overlays-0142.html
 * (one `?case=` each).
 *
 * UG-31: a Dialog or Sheet rendered open at first render (a deep link) shows
 *   its panel and its backdrop. The backdrop used to enter the top layer
 *   before the portal moved it, and the move hid it again.
 * Popover handoff: a non-modal Popover closed in the same handler that opens
 *   another overlay leaves focus in that overlay when its exit motion ends;
 *   it used to pull focus back to its trigger, which closed the new overlay.
 * UG-27: a Toggle or ToggleGroup given a value and a change handler (no
 *   `bind:`) renders the value it is given, not its own.
 */

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`/overlays-0142.html?${query}`);
  await expect(page.locator('#app > *').first()).toBeAttached({ timeout: 30_000 });
}

/** Whether the element on top at the center of `selector` is it (or inside it). */
async function onTop(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((node) => {
    const box = node.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && (hit === node || node.contains(hit));
  });
}

/** A backdrop that paints: in the top layer and not `display: none`. */
async function backdropShown(page: Page, selector: string): Promise<boolean> {
  return page
    .locator(selector)
    .evaluate((node) => node.matches(':popover-open') && getComputedStyle(node).display !== 'none');
}

test('UG-31: a Dialog and a Sheet mounted open show their panel above a painted backdrop', async ({
  page,
}) => {
  for (const { query, name, panel, backdrop } of [
    {
      query: 'case=dialog-open',
      name: 'Deep-linked settings',
      panel: '[data-tx-dialog]',
      backdrop: '[data-tx-dialog-overlay]',
    },
    {
      query: 'case=sheet-open',
      name: 'Deep-linked filters',
      panel: '[data-tx-sheet]',
      backdrop: '[data-tx-sheet-overlay]',
    },
  ]) {
    await open(page, query);
    await expect(page.getByRole('dialog', { name })).toBeVisible();
    await expect.poll(() => backdropShown(page, backdrop), query).toBe(true);
    await expect.poll(() => onTop(page, panel), query).toBe(true);
    // The backdrop covers the page around the panel.
    const covered = await page.evaluate((css) => {
      const hit = document.elementFromPoint(4, 4);
      return hit?.closest(css) !== null;
    }, backdrop);
    expect(covered, query).toBe(true);
  }
});

test('a Popover closed while another overlay takes focus leaves focus there after its exit', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // "Second" is declared before the first popover, "Third" after it.
  for (const target of ['Second', 'Third']) {
    await open(page, 'case=popover-handoff');
    await page.getByRole('button', { name: 'First popover' }).click();
    await expect(page.getByRole('button', { name: 'Open second' })).toBeVisible();
    await page.getByRole('button', { name: `Open ${target.toLowerCase()}` }).click();
    // The first popover's exit ends and it unmounts.
    await expect(page.getByRole('dialog', { name: 'First panel' })).toHaveCount(0);
    const panel = page.getByRole('dialog', { name: `${target} panel` });
    await expect(panel, target).toBeVisible();
    await expect(page.getByRole('button', { name: `${target} action` }), target).toBeFocused();
    await expect(page.getByRole('button', { name: 'First popover' }), target).not.toBeFocused();
  }
});

test('UG-27: a controlled Toggle and ToggleGroup without bind: render the value they are given', async ({
  page,
}) => {
  await open(page, 'case=toggle-controlled');
  const bold = page.getByRole('button', { name: 'Bold' });
  await bold.click();
  await expect(page.locator('#toggle-calls')).toHaveText('true');
  await expect(bold).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Right' }).click();
  await expect(page.locator('#group-calls')).toHaveText('right');
  await expect(page.getByRole('button', { name: 'Right' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await expect(page.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed', 'true');
});

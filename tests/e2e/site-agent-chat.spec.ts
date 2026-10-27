import { expect, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/**
 * The agent chat page as built today: no agent endpoint is configured, so
 * the island shows the honest "not running" state and sends nothing, at
 * every width, with 44px prompt targets. The available flow is covered
 * in-process by apps/agent/tests/island.test.ts; axe on this page runs in the
 * page sweep, a11y-site-<n>.spec.ts.
 */

const origin = serveDist();

test('shows the honest unavailable state, sends nothing, and fits 360 to 1440px', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin()}/agent-chat/`);
    await settle(page);
    await expect(page.locator('[data-tx-agent-unavailable="not-configured"]')).toContainText(
      'not running on texuli.com yet'
    );
    const presets = page.getByRole('group', { name: 'Example prompts' }).getByRole('button');
    await expect(presets).toHaveCount(3);
    for (const preset of await presets.all()) await expect(preset).toBeDisabled();
    for (const height of await presets.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height)
    ))
      expect(height, `${width}px prompt height`).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
      `${width}px overflow`
    ).toBeLessThanOrEqual(0);
    const columns = await page
      .locator('[data-tx-agent-chat]')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns, `${width}px columns`).toBe(width >= 1024 ? 2 : 1);
  }
  // The draft lifecycle waits for a request that never happens.
  await expect(page.getByText('Draft · untrusted · not activated')).toBeVisible();
  await expect(page.locator('[data-tx-agent-lifecycle] li[data-state="upcoming"]')).toHaveCount(5);
  await expect(page.locator('[data-tx-agent-steps]')).toHaveCount(0);
  expect(foreign).toEqual([]);
});

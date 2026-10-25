import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

test('chat thread example renders safe grouped messages and passes axe in light and dark', async ({
  page,
}) => {
  await page.goto('/?fixture=chat-thread&mode=light');
  const host = page.locator('[data-example-host="chat-thread"]');
  await expect(host.getByRole('log', { name: 'Messages' })).toBeVisible();
  await expect(host.locator('[data-message-group]')).toHaveCount(4);
  expect(
    (await new AxeBuilder({ page }).include('[data-example-host="chat-thread"]').analyze())
      .violations
  ).toEqual([]);

  await host.getByRole('button', { name: 'Load long history' }).click();
  await expect(host.locator('[data-virtualized="true"]')).toBeVisible();
  await expect.poll(async () => host.locator('[data-message-group]').count()).toBeLessThan(30);
  const log = host.getByRole('log');
  const previousTop = await log.evaluate((element) => {
    element.scrollTop = 500;
    element.dispatchEvent(new Event('scroll'));
    return element.scrollTop;
  });
  await host.getByRole('button', { name: 'Load earlier messages' }).click();
  await expect
    .poll(() => log.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(previousTop);

  await page.goto('/?fixture=chat-thread&mode=dark');
  await expect(page.locator('[data-example-host="chat-thread"]').getByRole('log')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('[data-example-host="chat-thread"]').analyze())
      .violations
  ).toEqual([]);
});

/**
 * Scrolls the virtualized log to 500 px, waits for `clickWhen`, clicks
 * "Load earlier messages", then reports where the row that covered the top
 * edge sits right after the prepend renders and after later frames re-measure.
 * Runs in the page so the click and both readings are tied to known frames.
 */
async function loadEarlierFrom500(
  page: Page,
  clickWhen: 'settled' | 'between-measure-and-render'
): Promise<{
  scrollTopBefore: number;
  anchorOffset: number;
  offsetAfterPrepend: number | null;
  offsetSettled: number | null;
  scrollTopSettled: number;
}> {
  const log = page.locator('[data-example-host="chat-thread"]').getByRole('log');
  return log.evaluate(async (element, mode) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const topRow = () => {
      const top = element.getBoundingClientRect().top;
      for (const row of element.querySelectorAll<HTMLElement>('[data-message-group]')) {
        const rect = row.getBoundingClientRect();
        if (rect.bottom > top) return { key: row.dataset.messageGroup ?? '', top: rect.top - top };
      }
      throw new Error('no rendered row');
    };
    const offsetOf = (key: string) => {
      const row = element.querySelector<HTMLElement>(`[data-message-group="${key}"]`);
      return row
        ? Math.round(row.getBoundingClientRect().top - element.getBoundingClientRect().top)
        : null;
    };
    const earlier = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Load earlier messages'
    );
    if (!earlier) throw new Error('no load earlier button');

    element.scrollTop = 500;
    element.dispatchEvent(new Event('scroll'));
    const scrollTopBefore = element.scrollTop;
    // Let the window render the rows around 500 px.
    await new Promise((resolve) => setTimeout(resolve, 0));
    let anchor = topRow();
    if (mode === 'settled') {
      for (let index = 0; index < 4; index += 1) await frame();
      anchor = topRow();
      earlier.click();
    } else {
      // Created after the list's row observers, so in the frame that measures
      // the new rows it runs after them and clicks before the list re-renders
      // them: the timing a busy machine produces.
      await new Promise<void>((resolve) => {
        const observer = new ResizeObserver(() => {
          observer.disconnect();
          anchor = topRow();
          earlier.click();
          resolve();
        });
        for (const row of element.querySelectorAll('[data-message-group]')) observer.observe(row);
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    const offsetAfterPrepend = offsetOf(anchor.key);
    for (let index = 0; index < 10; index += 1) await frame();
    return {
      scrollTopBefore,
      anchorOffset: Math.round(anchor.top),
      offsetAfterPrepend,
      offsetSettled: offsetOf(anchor.key),
      scrollTopSettled: element.scrollTop,
    };
  }, clickWhen);
}

async function openLongHistory(page: Page): Promise<void> {
  await page.goto('/?fixture=chat-thread&mode=light');
  const host = page.locator('[data-example-host="chat-thread"]');
  await expect(host.getByRole('log')).toBeVisible();
  await host.getByRole('button', { name: 'Load long history' }).click();
  await expect(host.locator('[data-virtualized="true"]')).toBeVisible();
}

test('loading earlier messages keeps the anchor message in place on a throttled CPU', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CPU throttling uses the Chrome DevTools Protocol');
  await page.goto('/?fixture=chat-thread&mode=light');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await openLongHistory(page);
  const result = await loadEarlierFrom500(page, 'settled');
  expect(result.offsetAfterPrepend).toBe(result.anchorOffset);
  expect(result.offsetSettled).toBe(result.anchorOffset);
  expect(result.scrollTopSettled).toBeGreaterThan(result.scrollTopBefore);
});

test('loading earlier messages between a row measurement and its re-render keeps the anchor and never scrolls down', async ({
  page,
}) => {
  await openLongHistory(page);
  const result = await loadEarlierFrom500(page, 'between-measure-and-render');
  expect(result.offsetAfterPrepend).toBe(result.anchorOffset);
  expect(result.offsetSettled).toBe(result.anchorOffset);
  expect(result.scrollTopSettled).toBeGreaterThan(result.scrollTopBefore);
});

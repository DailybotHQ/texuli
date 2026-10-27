import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * Chat in a real browser: the thread's virtualized log keeps the reader's
 * anchor when earlier messages load (also under a busy machine's frame
 * timing), and the thread and composer examples pass axe in light and dark.
 * Grouping, streaming, hostile text and the composer's Enter, Shift+Enter
 * and IME rules are unit-tested in packages/chat/tests/components.test.ts.
 */

async function axeProblems(page: Page, id: string, label: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).include(`[data-example-host="${id}"]`).analyze();
  return results.violations.map(
    (violation) =>
      `${id} (${label}) ${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

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

test('chat: thread and composer pass axe in light and dark; loading earlier messages keeps the anchor', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  const problems: string[] = [];

  await test.step('the thread and the composer render and pass axe in light and dark', async () => {
    for (const mode of ['light', 'dark'] as const) {
      await page.goto(`/?fixture=chat-thread&mode=${mode}`);
      const thread = page.locator('[data-example-host="chat-thread"]');
      await expect(thread.getByRole('log', { name: 'Messages' })).toBeVisible();
      await expect(thread.locator('[data-message-group]')).toHaveCount(4);
      problems.push(...(await axeProblems(page, 'chat-thread', mode)));

      await page.goto(`/?fixture=chat-composer&mode=${mode}`);
      const composer = page.locator('[data-example-host="chat-composer"]');
      const field = composer.getByRole('textbox', { name: 'Message' });
      await expect(field).toBeVisible();
      await expect(composer.getByRole('button', { name: 'Attach a file' })).toBeVisible();
      await expect(composer.getByRole('status')).toContainText('Jordan is typing');
      await field.fill('A first line');
      await field.press('Shift+Enter');
      await field.pressSequentially('A second line');
      await field.press('Enter');
      await expect(composer.getByRole('list', { name: 'Sent messages' })).toContainText(
        'A first line\nA second line'
      );
      problems.push(...(await axeProblems(page, 'chat-composer', mode)));
    }
  });

  await test.step('a long history is windowed and loading earlier messages scrolls to keep place', async () => {
    await openLongHistory(page);
    const host = page.locator('[data-example-host="chat-thread"]');
    await expect.poll(async () => host.locator('[data-message-group]').count()).toBeLessThan(30);
  });

  await test.step('loading earlier messages between a row measurement and its re-render keeps the anchor and never scrolls down', async () => {
    await openLongHistory(page);
    const result = await loadEarlierFrom500(page, 'between-measure-and-render');
    expect(result.offsetAfterPrepend).toBe(result.anchorOffset);
    expect(result.offsetSettled).toBe(result.anchorOffset);
    expect(result.scrollTopSettled).toBeGreaterThan(result.scrollTopBefore);
  });

  // CPU throttling uses the Chrome DevTools Protocol.
  if (browserName === 'chromium') {
    await test.step('loading earlier messages keeps the anchor message in place on a throttled CPU', async () => {
      await page.goto('/?fixture=chat-thread&mode=light');
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      await openLongHistory(page);
      const result = await loadEarlierFrom500(page, 'settled');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      expect(result.offsetAfterPrepend).toBe(result.anchorOffset);
      expect(result.offsetSettled).toBe(result.anchorOffset);
      expect(result.scrollTopSettled).toBeGreaterThan(result.scrollTopBefore);
    });
  }

  expect(problems).toEqual([]);
});

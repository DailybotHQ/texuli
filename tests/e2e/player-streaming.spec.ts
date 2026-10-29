import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * `<Player stream>` in a real browser (ADR-014): a spec golden streamed
 * chunk by chunk (fixture page `player-streaming.html`) paints validated
 * nodes progressively under an accessible busy state, passes axe while
 * streaming and once complete (light, dark and forced colors), ends with the same paint
 * as the golden passed whole, and recovers from an interruption through a
 * retry.
 */

const STREAM = '[data-streaming="stream"]';
const WHOLE = '[data-streaming="whole"]';

async function open(page: Page, query = '') {
  await page.goto(`/player-streaming.html${query}`);
  await expect(page.locator('#streaming-status')).toHaveText('Ready', { timeout: 30_000 });
}

/** Write `count` more chunks and wait for the coalesced paint. */
async function write(page: Page, count: number): Promise<number> {
  const left = await page.evaluate((n) => window.txStreaming.write(n), count);
  await page.waitForTimeout(120);
  return left;
}

/** Nodes painted now (the player's own count) and the text the surface shows. */
const painted = (page: Page) =>
  page.evaluate(() => window.txStreaming.progress().at(-1)?.painted ?? 0);
const shownText = (page: Page) =>
  page.evaluate(
    (selector) =>
      document.querySelector(`${selector} [data-tx-player-surface]`)?.textContent?.length ?? 0,
    STREAM
  );

/** The surface markup without generated ids, so the two players compare equal. */
const markup = (page: Page, selector: string) =>
  page.evaluate((host) => {
    const surface = document.querySelector(`${host} [data-tx-player-surface]`);
    return (surface?.innerHTML ?? '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(
        /\s(id|for|aria-labelledby|aria-describedby|aria-controls|aria-owns|aria-activedescendant|href|name)="[^"]*"/g,
        ' $1=""'
      )
      .replace(/url\(#[^)]*\)/g, 'url(#)');
  }, selector);

async function axe(page: Page, label: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).include('#streaming').analyze();
  return results.violations.map(
    (v) => `${label}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`
  );
}

test.describe('player streaming', () => {
  for (const mode of ['light', 'dark', 'forced colors'] as const) {
    test(`paints progressively, stays accessible and ends equal to the whole paint (${mode})`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      if (mode === 'forced colors') await page.emulateMedia({ forcedColors: 'active' });
      await open(page, `?mode=${mode === 'dark' ? 'dark' : 'light'}`);
      const root = page.locator(`${STREAM} [data-tx-player]`);
      const surface = page.locator(`${STREAM} [data-tx-player-surface]`);
      await expect(root).toHaveAttribute('data-status', 'streaming');
      await expect(page.locator(`${STREAM} .tx-player__badge`)).toHaveText('Generating');

      // Progressive: the painted count grows in steps while the stream is open.
      const counts: number[] = [];
      const texts: number[] = [];
      const total = await page.evaluate(() => window.txStreaming.chunks);
      const step = Math.max(1, Math.floor(total / 8));
      let left = total;
      let checkedMidStream = false;
      while (left > 0) {
        left = await write(page, step);
        counts.push(await painted(page));
        texts.push(await shownText(page));
        if (left > 0) {
          await expect(surface).toHaveAttribute('aria-busy', 'true');
          await expect(surface).toHaveAttribute('inert', '');
        }
        if (!checkedMidStream && counts[counts.length - 1] > 2 && left > 0) {
          checkedMidStream = true;
          // A pending node shows a busy skeleton; nothing waits on actions.
          await expect(
            page.locator(`${STREAM} [data-tx-player-stream-node="pending"]`).first()
          ).toBeAttached();
          expect(await axe(page, `${mode} mid-stream`)).toEqual([]);
        }
      }
      expect(checkedMidStream).toBe(true);
      expect(new Set(counts.filter((n) => n > 0)).size).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < counts.length; i += 1) {
        expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1] as number);
      }
      // What the reader sees grows too, before the stream ends.
      expect(new Set(texts.filter((n) => n > 0)).size).toBeGreaterThanOrEqual(3);

      // Complete: validated, armed, settled, and the same paint as the whole golden.
      await page.evaluate(() => window.txStreaming.end());
      await expect(root).toHaveAttribute('data-status', 'draft', { timeout: 30_000 });
      await expect(surface).not.toHaveAttribute('aria-busy', /.*/);
      await expect(surface).not.toHaveAttribute('inert', /.*/);
      await expect(page.locator('[data-tx-player-skeleton]')).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(`${STREAM} [data-tx-player-announcer]`)).toHaveText(
        /Content ready/
      );
      const phases = await page.evaluate(() => window.txStreaming.progress().map((p) => p.phase));
      expect(phases.at(-1)).toBe('complete');
      expect(await axe(page, `${mode} complete`)).toEqual([]);
      // The same golden painted whole, next to it: the same markup.
      await page.evaluate(() => window.txStreaming.mountWhole());
      await expect(page.locator(`${WHOLE} [data-tx-player]`)).toHaveAttribute(
        'data-status',
        'draft'
      );
      await expect(page.locator('[data-tx-player-skeleton]')).toHaveCount(0, { timeout: 30_000 });
      await expect
        .poll(async () => (await markup(page, STREAM)) === (await markup(page, WHOLE)), {
          timeout: 15_000,
        })
        .toBe(true);
      expect((await markup(page, STREAM)).length).toBeGreaterThan(1000);
    });
  }

  test('an interruption keeps the painted nodes, shows a recoverable error, and a retry completes', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await open(page, '?fixture=app-dashboard');
    const root = page.locator(`${STREAM} [data-tx-player]`);
    const total = await page.evaluate(() => window.txStreaming.chunks);
    await write(page, total - 2);
    const toggle = page.locator(STREAM).getByRole('switch', { name: 'Renewals only' });
    await expect(toggle).toBeVisible({ timeout: 30_000 });
    const before = await painted(page);
    await page.evaluate(() => window.txStreaming.abort());
    await expect(root).toHaveAttribute('data-status', 'interrupted');
    const alert = page.locator(STREAM).getByRole('alert');
    await expect(alert).toContainText('Generation stopped');
    expect(await painted(page)).toBe(before);
    // Disarmed: the readable but incomplete tree changes nothing.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await axe(page, 'interrupted')).toEqual([]);

    await alert.getByRole('button', { name: 'Try again' }).click();
    expect(await page.evaluate(() => window.txStreaming.retries())).toBe(1);
    await page.evaluate(() => window.txStreaming.restart());
    await expect(root).toHaveAttribute('data-status', 'streaming');
    await write(page, total);
    await page.evaluate(() => window.txStreaming.end());
    await expect(root).toHaveAttribute('data-status', 'draft', { timeout: 30_000 });
    await expect(page.locator('[data-tx-player-skeleton]')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator(STREAM).getByRole('alert')).toHaveCount(0);
    // Armed once validated: the same toggle now changes state.
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => markup(page, STREAM)).not.toBe('');
  });
});

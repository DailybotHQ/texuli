/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/**
 * The agent chat page as built today: no agent endpoint is configured, so
 * the island must show the honest "not running" state and send nothing.
 * The available flow is covered in-process by apps/agent/tests/island.test.ts.
 */

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'agent-chat', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing /agent-chat/).');
  }
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '404');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

async function visit(page: Page) {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}/agent-chat/`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 250 }
  );
  await expect(page.locator('[data-tx-agent-unavailable]')).toBeVisible();
  expect(foreign).toEqual([]);
}

test.describe('texuli.com agent chat', () => {
  test('shows the honest unavailable state and sends nothing', async ({ page }) => {
    await visit(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Agent chat' })).toBeVisible();
    await expect(page.locator('[data-tx-agent-unavailable="not-configured"]')).toContainText(
      'not running on texuli.com yet'
    );
    const presets = page.getByRole('group', { name: 'Example prompts' }).getByRole('button');
    await expect(presets).toHaveCount(3);
    for (const preset of await presets.all()) await expect(preset).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Draft preview' })).toBeVisible();
    await expect(page.getByText('Draft · untrusted · not activated')).toBeVisible();
    // Honest deployment status and the draft lifecycle, before any request.
    const deployment = page.locator('[data-tx-agent-deployment="not-deployed"]');
    await expect(deployment).toContainText('texuli.com does not run the agent service');
    const lifecycle = page.getByRole('list', { name: 'Draft lifecycle' }).getByRole('listitem');
    await expect(lifecycle).toHaveCount(5);
    await expect(lifecycle.last()).toContainText('Draft, not activated');
    await expect(page.locator('[data-tx-agent-lifecycle] li[data-state="upcoming"]')).toHaveCount(
      5
    );
    await expect(page.locator('[data-tx-agent-steps]')).toHaveCount(0);
    // The site navigation links the page (inside the menu on small screens).
    expect(await page.locator('a[href="/agent-chat/"]').count()).toBeGreaterThan(0);
  });

  test(`fits 360, 768, 1024 and 1440px without horizontal scroll, with 44px touch targets`, async ({
    page,
  }) => {
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await visit(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const heights = await page
        .getByRole('group', { name: 'Example prompts' })
        .getByRole('button')
        .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
      const columns = await page
        .locator('[data-tx-agent-chat]')
        .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(width >= 1024 ? 2 : 1);
    }
  });

  // axe on this page in light and dark (zero exclusions) runs in the page sweep,
  // a11y-site.spec.ts.
});

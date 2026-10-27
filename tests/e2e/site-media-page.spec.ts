/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com media lab, in the browser: the image, video, audio and
 * composition sections render from same-origin files, and the composition
 * exports a real PNG and records a real WebM (EBML header) with the native
 * MediaRecorder profile, with no request leaving the origin. The lab's
 * composition and animation are validated in scripts/tests/site-loaders.test.ts;
 * axe runs in the page sweep.
 */

const origin = serveDist();

test('renders every section and exports a PNG and a real WebM in the browser', async ({ page }) => {
  test.setTimeout(90_000);
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !/^(blob|data):/.test(url)) foreign.push(url);
  });
  await page.goto(`${origin()}/media-page/`);
  await settle(page);
  for (const id of ['#lab-image', '#lab-video', '#lab-audio', '#lab-composition'])
    await expect(page.locator(id)).toBeVisible();
  expect(await page.locator('#lab-image img').first().getAttribute('src')).toMatch(
    /media-lab\/harbor/
  );

  const exportGroup = page.getByRole('group', { name: /Export the harbor poster/i });
  const [png] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    exportGroup.getByRole('button', { name: /png/i }).click(),
  ]);
  expect(png.suggestedFilename()).toMatch(/\.png$/i);
  const pngBytes = readFileSync((await png.path()) as string);
  expect([...pngBytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

  const webmButton = exportGroup.getByRole('button', { name: /webm/i });
  await expect(webmButton).toBeEnabled();
  const [webm] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    webmButton.click(),
  ]);
  expect(webm.suggestedFilename()).toMatch(/\.webm$/i);
  const webmBytes = readFileSync((await webm.path()) as string);
  expect([...webmBytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /\.webm|Saved/i })
      .first()
  ).toBeVisible();
  expect(foreign).toEqual([]);
});

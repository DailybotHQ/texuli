/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { PAGE_BLOCKS } from '../../apps/website/src/components/blocks-page/blocks.ts';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com blocks and templates, in the browser: the copy buttons put the
 * install command and the exact source on the clipboard, the interactive
 * previews hydrate and work (the FAQ accordion by keyboard, the sign-in
 * validation), and every template page loads its preview. The install
 * commands against the imports and the add registry are unit-tested in
 * apps/website/tests/component-pages.test.ts; axe runs in the page sweep.
 */

const origin = serveDist();
const SECTIONS = resolve('apps/website/src/components/blocks-page/sections');

test('copy buttons, interactive previews and every template page', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/blocks-page/`);
  await settle(page);

  const hero = page.locator('[data-block="hero"]');
  await expect(hero.locator('astro-island[ssr]')).toHaveCount(0);
  await hero.getByRole('button', { name: 'Copy the Hero install command' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('texuli add badge button');
  await hero.locator('summary').click();
  await hero.getByRole('button', { name: 'Copy the Hero source' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(readFileSync(join(SECTIONS, 'HeroSection.svelte'), 'utf8'));

  const faq = page.locator('[data-block="faq"]');
  await faq.scrollIntoViewIfNeeded();
  await expect(faq.locator('.block__preview astro-island[ssr]')).toHaveCount(0);
  const question = faq.getByRole('button', { name: 'Can I export the logs?' });
  await expect(question).toHaveAttribute('aria-expanded', 'false');
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await expect(
    faq
      .getByRole('region', { name: 'FAQ preview', exact: true })
      .getByText('Captain and Harbor export any date range')
  ).toBeVisible();

  const auth = page
    .locator('[data-block="auth"]')
    .getByRole('region', { name: 'Sign in preview', exact: true });
  const signIn = auth.getByRole('button', { name: 'Sign in', exact: true });
  await signIn.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-block="auth"] .block__preview astro-island[ssr]')).toHaveCount(
    0
  );
  await signIn.click();
  await expect(auth.getByText('Enter an email such as ada@harbor.example.')).toBeVisible();
  await expect(auth.getByRole('textbox', { name: /Email/ })).toHaveAttribute(
    'aria-invalid',
    'true'
  );
  await auth.getByRole('textbox', { name: /Email/ }).fill('ada@harbor.example');
  await auth.getByLabel(/Password/).fill('correct horse');
  await signIn.click();
  await expect(auth.getByRole('status')).toHaveText(
    'Demo only: ada@harbor.example would be signed in now.'
  );
  expect(page.url()).toBe(`${origin()}/blocks-page/`);

  for (const block of PAGE_BLOCKS) {
    await page.goto(`${origin()}/blocks-page/${block.id}/`);
    await expect(
      page.getByRole('heading', { level: 1, name: `${block.title} template` })
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: `${block.title} preview`, exact: true })
    ).toBeVisible();
  }
  expect(foreign).toEqual([]);
});

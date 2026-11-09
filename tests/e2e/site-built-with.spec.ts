import { expect, test } from '@playwright/test';
import { serveDist } from './support/site.ts';

/*
 * Built with Texuli: the public index lists only the audited product, its case study keeps
 * roadmap status explicit, external links carry noopener, and the Markdown twin agrees.
 * Run `pnpm build` before this spec.
 */

const origin = serveDist();

test('the index lists Protoyard only and marks Protoyard Cloud planned', async ({ page }) => {
  const response = await page.goto(`${origin()}/built-with/`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Built with Texuli' })).toBeVisible();

  const cards = page.locator('[data-tx-built-with-index] [data-product]');
  await expect(cards).toHaveCount(1);
  const protoyard = page.locator('[data-tx-built-with-index] [data-product="protoyard"]');
  await expect(protoyard).toBeVisible();
  await expect(protoyard).toContainText('Protoyard');
  await expect(protoyard).not.toContainText('Ronin');
  await expect(protoyard.locator('li[data-status="planned"]')).toContainText('Protoyard Cloud');
  await expect(page.locator('body')).not.toContainText('Ronin');
  await expect(protoyard.getByRole('link', { name: 'Read the case study' })).toHaveAttribute(
    'href',
    '/built-with/protoyard/'
  );

  const external = protoyard.locator('a[href="https://protoyard.app"]');
  await expect(external).toHaveAttribute('rel', /(?:^|\s)noopener(?:\s|$)/);
});

test('the Protoyard case study labels its local product and cloud roadmap honestly', async ({
  page,
}) => {
  const response = await page.goto(`${origin()}/built-with/protoyard/`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Protoyard' })).toBeVisible();
  await expect(page.locator('.protoyard__status')).toContainText('Available');

  const roadmap = page.locator('[data-roadmap]');
  await expect(roadmap.getByRole('heading', { name: 'Roadmap' })).toBeVisible();
  const cloud = roadmap.locator('li[data-status="planned"]', { hasText: 'Protoyard Cloud' });
  await expect(cloud).toBeVisible();
  await expect(cloud).toContainText('Planned');
  await expect(page.locator('body')).not.toContainText('Ronin');

  const external = page.locator('a[href="https://protoyard.app"]');
  await expect(external).toHaveAttribute('rel', /(?:^|\s)noopener(?:\s|$)/);
});

test('the Markdown twin preserves the Protoyard Cloud planned status', async () => {
  const response = await fetch(`${origin()}/built-with/protoyard.md`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/markdown');
  const body = await response.text();
  expect(body).toContain('Protoyard');
  expect(body).toContain('https://texuli.com/built-with/protoyard/');
  expect(body).toContain('Protoyard Cloud');
  expect(body).toMatch(/planned/i);
  expect(body).not.toContain('Ronin');
});

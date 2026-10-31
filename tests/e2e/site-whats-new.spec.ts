import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  AXE_TAGS,
  expectMode,
  polishProblems,
  serveDist,
  settle,
  settleAnimations,
} from './support/site.ts';

/*
 * texuli.com /whats-new/ (PLAN_010 T-site-080, Amendment 8), in the
 * browser: the hub lists every feature of 0.6.0 to 0.10.0 under its
 * release with an honest status, each with a demo or preview that works
 * (motion plays, a formula evaluates, a widget moves by keyboard, a form
 * validates, the locale switches, the canvas image and the email frame
 * load) and a link to a page that exists; the home page and the sidebar
 * link to it; axe in light and dark; at 360 px nothing overflows.
 *
 * Data and copy are unit-tested in apps/website/tests/site-whats-new.test.ts.
 */

const origin = serveDist();

/**
 * axe on the page with no disabled rules, skipping only the scriptless
 * sandboxed email frame (axe cannot run inside a frame without scripts and
 * waits for it); the email document gets its own axe run as a top-level page.
 */
async function axeOutsideSandbox(page: Page): Promise<string[]> {
  await settleAnimations(page);
  const result = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .exclude('iframe[sandbox=""]')
    .analyze();
  return result.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !url.startsWith('data:') && !url.startsWith('blob:'))
      foreign.push(url);
  });
  return foreign;
}

async function hydrated(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 20_000,
  });
}

test('every feature by release, each demo working, links that resolve; axe light and dark', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/whats-new/`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What’s new in Texuli');
  await expect(page.locator('[data-hub-release]')).toHaveCount(5);
  await expect(page.locator('[data-hub-feature]')).toHaveCount(24);
  await expect(page.locator('[data-hub-release="0.8.0"] .hub__status')).toContainText(
    'Published on npm as 0.8.0'
  );
  await expect(page.locator('[data-hub-release="0.7.0"] .hub__status')).toContainText(
    'Published on npm as 0.7.0'
  );
  await expect(page.locator('[data-hub-release="0.8.0"] [data-hub-feature]')).toHaveCount(7);
  // PLAN_011 T-release-090: 0.9.0 is on the hub as the current release.
  await expect(page.locator('[data-hub-release="0.9.0"] .hub__status')).toContainText(
    'Published on npm as 0.9.0, the current release'
  );
  await expect(page.locator('[data-hub-release="0.9.0"] [data-hub-feature]')).toHaveCount(5);
  // 0.10.0 is on the hub in development (the release line in docs/RELEASE.md).
  await expect(page.locator('[data-hub-release="0.10.0"] .hub__status')).toContainText(
    'In development on the release/0.10.0 branch'
  );
  // PLAN_011 T-site-0100: what landed on the branch (design systems, the studio, the ds tools,
  // conformance, the Protoyard gaps and the removals).
  await expect(page.locator('[data-hub-release="0.10.0"] [data-hub-feature]')).toHaveCount(6);
  await expect(page.locator('[data-hub-ds-brands]')).toContainText('Tumbletown');

  // Every card links to a page that exists.
  const hrefs = await page
    .locator('[data-hub-feature] .hub__more a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs).toHaveLength(24);
  for (const href of new Set(hrefs.map((href) => href.replace(/#.*$/, '')))) {
    const response = await page.request.get(`${origin()}${href}`);
    expect(response.status(), href).toBe(200);
  }

  // Motion plays through the runtime.
  await hydrated(page, '[data-hub-demo="motion"]');
  await page.locator('[data-hub-demo="motion"]').getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('[data-hub-motion-outcome]')).toContainText('rise:', {
    timeout: 10_000,
  });

  // A formula evaluates.
  await hydrated(page, '[data-hub-demo="sheets"]');
  await expect(page.locator('[data-hub-sheet-result]')).toHaveText('= 820');
  await page.locator('[data-hub-demo="sheets"] input').fill('=MAX(B2:B9) * 2');
  await expect(page.locator('[data-hub-sheet-result]')).toHaveText('= 620');

  // A widget moves by keyboard.
  await hydrated(page, '[data-hub-demo="dashboards"]');
  const handle = page.locator('[data-hub-demo="dashboards"]').getByRole('button', {
    name: 'Move Orders',
  });
  await handle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-hub-demo="dashboards"] [role="status"]')).toContainText(
    'Orders dropped at column'
  );

  // The form refuses an empty submit, then sends typed values.
  await hydrated(page, '[data-hub-demo="forms"]');
  const form = page.locator('[data-hub-demo="forms"]');
  await form.getByRole('button', { name: 'Request access' }).click();
  await expect(form.getByLabel(/Work email/)).toHaveAttribute('aria-invalid', 'true');
  await form.getByLabel(/Work email/).fill('ada@example.com');
  await form.getByLabel(/Seats/).fill('3');
  await form.getByRole('button', { name: 'Request access' }).click();
  await expect(page.locator('[data-hub-form-sent]')).toContainText('"seats":3');

  // The locale switches to the pseudo-locale.
  await hydrated(page, '[data-hub-demo="i18n"]');
  await page.locator('[data-hub-demo="i18n"]').getByLabel('Pseudo-locale (en-XA)').check();
  await expect(page.locator('[data-hub-locale="en-XA"]')).toBeVisible();
  await expect(page.locator('[data-hub-locale="en-XA"]')).toContainText('⟦');

  // The static previews load.
  const canvas = page.locator('[data-hub-feature="canvas"] img');
  await canvas.scrollIntoViewIfNeeded();
  await expect
    .poll(() => canvas.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await hydrated(page, '[data-output-email-preview]');
  await page
    .locator('[data-hub-feature="output"]')
    .getByRole('button', { name: 'Show the rendered email' })
    .click();
  const email = page.frameLocator('[data-hub-feature="output"] iframe');
  await expect(email.getByRole('heading', { name: 'Harbor weekly digest' })).toBeVisible({
    timeout: 20_000,
  });

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expectMode(page, scheme);
    expect(await axeOutsideSandbox(page), scheme).toEqual([]);
  }
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('the home page and the sidebar lead to the hub; 360 px fits', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`${origin()}/`);
  await settle(page);
  const news = page.locator('[data-tx-hero-news]');
  await expect(news).toHaveAttribute('href', '/whats-new/');
  await news.click();
  await expect(page).toHaveURL(/\/whats-new\/$/);
  await settle(page);
  await expect(page.locator('a[aria-current="page"][href="/whats-new/"]').first()).toBeAttached();
  await page.setViewportSize({ width: 360, height: 800 });
  for (const selector of [
    '[data-hub-demo="motion"]',
    '[data-hub-demo="sheets"]',
    '[data-hub-demo="dashboards"]',
    '[data-hub-demo="forms"]',
    '[data-hub-demo="i18n"]',
  ]) {
    await hydrated(page, selector);
  }
  expect(await polishProblems(page)).toEqual([]);
});

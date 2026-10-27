import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com slides area, in the browser: the live DeckStage advances,
 * reveals steps by button and keyboard, opens the presenter view and goes
 * fullscreen and back with focus restored; and with every example preview
 * loaded the page passes axe in light and dark. The area's links (templates,
 * examples, docs shell, showcase) are checked by the built-site link audit in
 * site-seo.spec.ts; the docs shell order is unit-tested in
 * scripts/tests/site-loaders.test.ts.
 */

const origin = serveDist();
const tour = (page: Page) => page.getByRole('region', { name: 'Presentation: Slides tour' });

test('the live stage advances, reveals, presents and goes fullscreen; axe clean with previews loaded', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/slides-page/`);
  await settle(page);
  await expect(tour(page)).toBeVisible({ timeout: 30_000 });
  const position = tour(page).locator('[aria-live="polite"]');
  const controls = tour(page).getByRole('group', { name: 'Presentation controls' });
  await expect(position).toHaveText('Slide 1 of 6: Slides tour');
  await controls.getByRole('button', { name: 'Next slide' }).click();
  await expect(position).toHaveText('Slide 2 of 6: Reveal steps, 0 of 4 revealed');
  await expect(tour(page).getByText('Plan the pilot')).toBeHidden();
  await controls.getByRole('button', { name: 'Next step' }).click();
  await expect(position).toHaveText('Slide 2 of 6: Reveal steps, 1 of 4 revealed');
  await expect(tour(page).getByText('Plan the pilot')).toBeVisible();

  // Keyboard from inside the slide: Right reveals, Left hides again; P presents.
  await tour(page).getByRole('article', { name: 'Reveal steps' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tour(page).getByText('Open the beta')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(tour(page).getByText('Open the beta')).toBeHidden();
  await page.keyboard.press('p');
  const notes = tour(page).getByRole('complementary', { name: 'Speaker notes' });
  await expect(notes).toContainText('Reveal step 1 of 4');
  await expect(tour(page).getByRole('region', { name: 'Up next' })).toContainText(
    'Reveal step 2 of 4 on this slide'
  );
  await page.keyboard.press('Escape');
  await expect(notes).toHaveCount(0);

  await tour(page).getByRole('button', { name: 'Fullscreen' }).click();
  await expect(tour(page)).toHaveAttribute('data-fullscreen', /^(native|viewport)$/);
  await tour(page).getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(tour(page)).not.toHaveAttribute('data-fullscreen', /.+/);
  await expect(tour(page).getByRole('button', { name: 'Fullscreen' })).toBeFocused();

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.reload();
    await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-tx-mode', scheme);
    await expect(tour(page)).toBeVisible({ timeout: 30_000 });
    // Previews load as they scroll into view; settle them before checking.
    const hosts = page.locator('[data-tx-example-host]');
    for (let index = 0; index < (await hosts.count()); index += 1)
      await hosts.nth(index).scrollIntoViewIfNeeded();
    await expect(page.getByText('Scroll to load this example.')).toHaveCount(0, {
      timeout: 30_000,
    });
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== 'running')
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${scheme} ${v.id}`)).toEqual([]);
  }
  expect(foreign).toEqual([]);
});

/**
 * Accessibility sweep: slides (T-p7-deck-a11y). The four slides examples are
 * the fixtures. axe with zero exclusions in light and dark (including a dark
 * host page on a light OS), presenter and overview states, forced colors,
 * 320px reflow, the deck keyboard map with focus movement, tab order, reduced
 * motion and the heading outline. Fix findings at source.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const TEMPLATES = [
  'slides-template-report',
  'slides-template-pitch',
  'slides-template-review',
] as const;
const ALL = [...TEMPLATES, 'slides-media-deck'] as const;
type SlidesFixture = (typeof ALL)[number];

async function gotoFixture(page: Page, id: SlidesFixture, mode: 'light' | 'dark' = 'light') {
  await page.goto(`/?fixture=${id}&mode=${mode}`);
  const host = page.locator(`[data-example-host="${id}"]`);
  await expect(host).toBeVisible({ timeout: 30_000 });
  // The demo holds this status until families, themes and code tokens settle.
  await expect(host.locator(':scope > p[role="status"]')).toHaveCount(0, { timeout: 30_000 });
  return host;
}

async function expectNoAxeViolations(page: Page, id: SlidesFixture) {
  // A slide entrance fade lowers opacity while it runs; check the settled page.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running')
  );
  const results = await new AxeBuilder({ page }).include(`[data-example-host="${id}"]`).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

const stage = (page: Page) => page.getByRole('region', { name: /^Presentation: / });
const progress = (page: Page) => stage(page).locator('.tx-deck-stage__progress');

test.describe('a11y slides · axe', () => {
  for (const id of ALL) {
    test(`${id} passes axe on a light page, a dark page and a dark page on a dark OS`, async ({
      page,
    }) => {
      await gotoFixture(page, id, 'light');
      await expectNoAxeViolations(page, id);
      // A dark host page while the OS prefers light: the deck follows the page.
      await gotoFixture(page, id, 'dark');
      await expectNoAxeViolations(page, id);
      await page.emulateMedia({ colorScheme: 'dark' });
      await gotoFixture(page, id, 'dark');
      await expectNoAxeViolations(page, id);
    });
  }

  for (const id of TEMPLATES) {
    test(`${id} passes axe with the overview and the presenter view open`, async ({ page }) => {
      for (const mode of ['light', 'dark'] as const) {
        await gotoFixture(page, id, mode);
        await page.getByRole('button', { name: 'Overview' }).click();
        await expect(page.getByRole('navigation', { name: 'Slides' })).toBeVisible();
        await expectNoAxeViolations(page, id);
        await page.getByRole('button', { name: 'Close overview' }).click();
        await page.getByRole('button', { name: 'Presenter' }).click();
        await expect(page.getByRole('complementary', { name: 'Speaker notes' })).toBeVisible();
        await expectNoAxeViolations(page, id);
      }
    });
  }

  for (const id of ['slides-template-report', 'slides-media-deck'] as const) {
    test(`${id} passes axe under forced colors`, async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
      await gotoFixture(page, id);
      await expectNoAxeViolations(page, id);
    });
  }

  for (const id of ALL) {
    test(`${id} reflows at 320 CSS px without horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await gotoFixture(page, id);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('a11y slides · structure and names', () => {
  test('the stage exposes a named region, a named controls group and a polite position', async ({
    page,
  }) => {
    await gotoFixture(page, 'slides-template-report');
    await expect(stage(page)).toHaveAccessibleName('Presentation: Quarterly report');
    const controls = stage(page).getByRole('group', { name: 'Presentation controls' });
    await expect(controls.getByRole('button')).toHaveText([
      'Previous',
      'Next',
      'Overview',
      'Presenter',
    ]);
    await expect(controls.getByRole('button', { name: 'Previous slide' })).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Next slide' })).toBeVisible();
    await expect(progress(page)).toHaveAttribute('aria-live', 'polite');
    await expect(progress(page)).toHaveText('Slide 4 of 6: Trend');
    // Outline: page h1, then the slide title as the deck's h2.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Report deck template');
    await expect(stage(page).getByRole('heading', { level: 2 })).toHaveText(['Trend']);
    await expect(stage(page).getByRole('article', { name: 'Trend' })).toBeVisible();
  });

  test('presenter panes are a complementary notes region, an up-next region and a timer', async ({
    page,
  }) => {
    await gotoFixture(page, 'slides-template-pitch');
    await page.getByRole('button', { name: 'Presenter' }).click();
    await expect(page.getByRole('button', { name: 'Presenter' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByRole('complementary', { name: 'Speaker notes' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Up next' })).toContainText('Traction');
    await expect(page.getByRole('timer', { name: 'Elapsed time' })).toBeVisible();
    await expect(stage(page).getByRole('heading', { level: 2 })).toHaveText([
      'The solution',
      'Speaker notes',
      'Up next',
    ]);
  });

  test('the print view is one region per slide with an h2 title and no focus traps', async ({
    page,
  }) => {
    await gotoFixture(page, 'slides-media-deck');
    const print = page.getByRole('document', { name: 'Print: Harbor tour' });
    await expect(print.getByRole('region')).toHaveCount(3);
    await expect(print.getByRole('heading', { level: 2 })).toHaveText([
      'The dock',
      'The yard',
      'Around the port',
    ]);
    // Nothing in the print view takes focus: Tab leaves the link and returns to the page.
    await page.getByRole('link', { name: 'All examples' }).focus();
    await page.keyboard.press('Tab');
    expect(await print.evaluate((el) => el.contains(document.activeElement))).toBe(false);
  });
});

test.describe('a11y slides · keyboard', () => {
  test('arrows, Page keys, Space, Home and End move between slides and focus the new slide', async ({
    page,
  }) => {
    await gotoFixture(page, 'slides-template-report');
    const press = async (key: string, expected: string, title: string) => {
      await page.keyboard.press(key);
      await expect(progress(page)).toHaveText(expected);
      await expect(stage(page).getByRole('article', { name: title })).toBeFocused();
    };
    await stage(page).getByRole('article', { name: 'Trend' }).focus();
    await press('ArrowRight', 'Slide 5 of 6: Risks', 'Risks');
    await press('ArrowLeft', 'Slide 4 of 6: Trend', 'Trend');
    await press('Home', 'Slide 1 of 6: Quarterly report', 'Quarterly report');
    await press('End', 'Slide 6 of 6: Next steps', 'Next steps');
    await press('PageUp', 'Slide 5 of 6: Risks', 'Risks');
    await press('Space', 'Slide 6 of 6: Next steps', 'Next steps');
    // The last slide does not wrap (loop is off in the template).
    await press('ArrowRight', 'Slide 6 of 6: Next steps', 'Next steps');
  });

  test('o opens the overview on the current slide; Escape closes it and returns focus', async ({
    page,
  }) => {
    await gotoFixture(page, 'slides-template-review');
    await stage(page).getByRole('article', { name: 'Demo' }).focus();
    await page.keyboard.press('o');
    const current = page
      .getByRole('navigation', { name: 'Slides' })
      .getByRole('button', { name: '4 Demo' });
    await expect(current).toBeFocused();
    await expect(current).toHaveAttribute('aria-current', 'step');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Slides' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Overview' })).toBeFocused();
  });

  test('p opens the presenter view, s focuses the notes, Escape closes and returns focus', async ({
    page,
  }) => {
    await gotoFixture(page, 'slides-template-pitch');
    await stage(page).getByRole('article', { name: 'The solution' }).focus();
    await page.keyboard.press('p');
    const notes = page.getByRole('complementary', { name: 'Speaker notes' });
    await expect(notes).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(notes).toContainText('Tell one customer story before the numbers.');
    await page.keyboard.press('s');
    await expect(notes).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(notes).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Presenter' })).toBeFocused();
  });

  test('tab order runs through the controls, then the slide content, then the presenter panes', async ({
    page,
  }, testInfo) => {
    // WebKit's default Tab skips links and buttons (a macOS setting), so the
    // tab-order walk runs on Chromium and Pixel 7.
    test.skip(testInfo.project.name === 'webkit', 'WebKit Tab order depends on a system setting');
    await gotoFixture(page, 'slides-template-review');
    await page.getByRole('button', { name: 'Presenter' }).click();
    await page.getByRole('link', { name: 'All examples' }).focus();
    const order: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          return (
            el.getAttribute('aria-label') ?? el.getAttribute('role') ?? el.textContent?.trim() ?? ''
          );
        })
      );
    }
    expect(order).toEqual([
      'Previous slide',
      'Next slide',
      'Overview',
      'Presenter',
      'Copy TS code',
      'region',
      'Pause timer',
      'Reset timer',
    ]);
  });

  test('single-key shortcuts act only while focus is inside the deck', async ({ page }) => {
    await gotoFixture(page, 'slides-template-report');
    await page.getByRole('link', { name: 'All examples' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('o');
    await expect(progress(page)).toHaveText('Slide 4 of 6: Trend');
    await expect(page.getByRole('navigation', { name: 'Slides' })).toHaveCount(0);
  });
});

test.describe('a11y slides · motion', () => {
  test('reduced motion cuts every transition; full motion keeps the deck token', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoFixture(page, 'slides-template-report');
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(stage(page)).toHaveAttribute('data-motion', 'reduce');
    await expect(stage(page).getByRole('article', { name: 'Risks' })).toHaveAttribute(
      'data-transition',
      'none'
    );

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await gotoFixture(page, 'slides-template-report');
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(stage(page).getByRole('article', { name: 'Risks' })).toHaveAttribute(
      'data-transition',
      'fade'
    );
  });
});

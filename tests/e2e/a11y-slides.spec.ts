/**
 * Accessibility sweep: slides (PLAN_008 stage v2). The seven slides examples
 * are the fixtures; three tests, each one page session. axe with zero
 * exclusions in light and dark (including a dark host page on a light OS),
 * with the overview, the presenter view, the help dialog and the blackout
 * open, and under forced colors; 320px reflow with the folded toolbar; the
 * deck keyboard map with focus movement, the chrome (slide list, help,
 * blackout, laser, full screen overlay), tab order, reveal steps and reduced
 * motion. Slides are `role="group"` with `aria-roledescription="slide"`;
 * toolbar names come from the stage messages. Fix findings at source.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const TEMPLATES = [
  'slides-template-report',
  'slides-template-pitch',
  'slides-template-review',
] as const;
const ALL = [
  ...TEMPLATES,
  'slides-media-deck',
  'slides-fragments',
  'slides-slot-masters',
  'slides-presenter-screen',
] as const;
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
  // A slide entrance or a chrome fade lowers opacity while it runs; check the settled page.
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running')
  );
  const results = await new AxeBuilder({ page }).include(`[data-example-host="${id}"]`).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

const stage = (page: Page) => page.getByRole('region', { name: /^Presentation: / });
const live = (page: Page) => stage(page).locator('.tx-deck-stage__live');
const slide = (page: Page, title: string) =>
  stage(page).locator(`[aria-roledescription="slide"][aria-label="${title}"]`);
const controls = (page: Page) => stage(page).getByRole('group', { name: 'Presentation controls' });
const tool = (page: Page, name: string | RegExp) => controls(page).getByRole('button', { name });

test('every deck passes axe on a light page, a dark page and a dark page on a dark OS', async ({
  page,
}) => {
  test.setTimeout(ALL.length * 40_000);
  for (const id of ALL) {
    await test.step(id, async () => {
      await page.emulateMedia({ colorScheme: 'light' });
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
});

test('structure and names; axe with the overview, presenter, help and blackout open and forced colors; 320px reflow', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await test.step('the templates pass axe with the overview, the presenter view, help and blackout open', async () => {
    for (const id of TEMPLATES) {
      for (const mode of ['light', 'dark'] as const) {
        await test.step(`${id} (${mode})`, async () => {
          await gotoFixture(page, id, mode);
          await tool(page, 'Overview of all slides').click();
          await expect(page.getByRole('navigation', { name: 'Slides' })).toBeVisible();
          await expectNoAxeViolations(page, id);
          await tool(page, 'Overview of all slides').click();
          await tool(page, 'Presenter view').click();
          await expect(page.getByRole('complementary', { name: 'Speaker notes' })).toBeVisible();
          await expectNoAxeViolations(page, id);
          await tool(page, 'Presenter view').click();
          await tool(page, 'Controls and shortcuts').click();
          await expect(page.getByRole('dialog', { name: 'Controls and shortcuts' })).toBeVisible();
          await expectNoAxeViolations(page, id);
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await tool(page, 'Black out the screen').click();
          await expect(
            stage(page).getByRole('button', { name: /^Screen blacked out/ })
          ).toBeFocused();
          await expectNoAxeViolations(page, id);
        });
      }
    }
  });
  await test.step('a template and the media deck pass axe under forced colors, also blacked out', async () => {
    await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
    for (const id of ['slides-template-report', 'slides-media-deck'] as const) {
      await gotoFixture(page, id);
      await expectNoAxeViolations(page, id);
    }
    await gotoFixture(page, 'slides-template-report');
    await tool(page, 'Black out the screen').click();
    await expectNoAxeViolations(page, 'slides-template-report');
    await page.emulateMedia({ forcedColors: 'none' });
  });
  await test.step('the stage is a named region with grouped, message-named controls and a polite position', async () => {
    await gotoFixture(page, 'slides-template-report');
    await expect(stage(page)).toHaveAccessibleName('Presentation: Quarterly report');
    const groups = controls(page).getByRole('group');
    await expect(groups).toHaveCount(5);
    for (const [name, buttons] of [
      [
        'Navigate',
        [
          'Previous step or slide',
          'Choose a slide, 4 / 6',
          'Next step or slide',
          'First slide',
          'Last slide',
        ],
      ],
      ['View', ['Overview of all slides', 'Full screen']],
      ['Present', ['Presenter view', 'Black out the screen', 'Laser pointer']],
      ['Share and print', ['Copy link to this slide', 'Print, one slide per page']],
      ['Help', ['Controls and shortcuts']],
    ] as const) {
      const group = controls(page).getByRole('group', { name, exact: true });
      for (const button of buttons)
        await expect(group.getByRole('button', { name: button })).toBeVisible();
    }
    await expect(tool(page, 'Black out the screen')).toHaveAttribute('aria-pressed', 'false');
    await expect(tool(page, 'Choose a slide, 4 / 6')).toHaveText('4 / 6');
    await expect(live(page)).toHaveAttribute('aria-live', 'polite');
    await expect(live(page)).toHaveText('Slide 4 of 6: Trend');
    await expect(stage(page).getByRole('progressbar', { name: 'Deck progress' })).toHaveAttribute(
      'aria-valuetext',
      'Slide 4 of 6'
    );
    // Outline: page h1, then the active slide title as the deck's only exposed h2.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Report deck template');
    await expect(stage(page).getByRole('heading', { level: 2 })).toHaveText(['Trend']);
    await expect(stage(page).getByRole('group', { name: 'Trend' })).toHaveAttribute(
      'aria-roledescription',
      'slide'
    );
    // A tooltip describes a control on keyboard focus.
    await stage(page).getByRole('group', { name: 'Trend' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('tooltip')).toHaveCount(1);
  });
  await test.step('the print view is one region per slide with an h2 title and no focus traps', async () => {
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
  await test.step('every deck reflows at 320 CSS px without horizontal scroll; the toolbar folds into More', async () => {
    test.setTimeout(ALL.length * 20_000);
    await page.setViewportSize({ width: 320, height: 640 });
    const overflows: string[] = [];
    for (const id of ALL) {
      await gotoFixture(page, id);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (overflow > 1) overflows.push(`${id}: ${overflow}px`);
    }
    expect(overflows).toEqual([]);
    await gotoFixture(page, 'slides-template-report');
    const more = stage(page)
      .getByRole('group', { name: 'Presentation controls' })
      .locator('summary');
    await expect(more).toHaveAccessibleName('More presentation controls');
    await more.click();
    await expect(
      controls(page).getByRole('button', { name: 'Controls and shortcuts' })
    ).toBeVisible();
    await expectNoAxeViolations(page, 'slides-template-report');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test('the deck keyboard map, chrome, tab order, reveal steps, fullscreen and motion', async ({
  page,
  browserName,
}) => {
  test.setTimeout(180_000);
  await test.step('arrows, Page keys, Space, Home and End move between slides and focus the new slide', async () => {
    await gotoFixture(page, 'slides-template-report');
    const press = async (key: string, expected: string, title: string) => {
      await page.keyboard.press(key);
      await expect(live(page)).toHaveText(expected);
      await expect(slide(page, title)).toBeFocused();
    };
    await slide(page, 'Trend').focus();
    await press('ArrowRight', 'Slide 5 of 6: Risks', 'Risks');
    await press('ArrowLeft', 'Slide 4 of 6: Trend', 'Trend');
    await press('Home', 'Slide 1 of 6: Quarterly report', 'Quarterly report');
    await press('End', 'Slide 6 of 6: Next steps', 'Next steps');
    await press('PageUp', 'Slide 5 of 6: Risks', 'Risks');
    await press('Space', 'Slide 6 of 6: Next steps', 'Next steps');
    // The last slide does not wrap (loop is off in the template).
    await press('ArrowRight', 'Slide 6 of 6: Next steps', 'Next steps');
  });
  await test.step('o opens the overview on the current slide; Escape closes it and returns focus to the slide', async () => {
    await gotoFixture(page, 'slides-template-review');
    await slide(page, 'Demo').focus();
    await page.keyboard.press('o');
    const current = page
      .getByRole('navigation', { name: 'Slides' })
      .getByRole('button', { name: '4 Demo', exact: true });
    await expect(current).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Slides' })).toHaveCount(0);
    await expect(slide(page, 'Demo')).toBeFocused();
  });
  await test.step('? opens the help dialog on Close, Tab stays inside, Escape closes and returns focus', async () => {
    await gotoFixture(page, 'slides-template-report');
    await slide(page, 'Trend').focus();
    await page.keyboard.press('Shift+?');
    const dialog = page.getByRole('dialog', { name: 'Controls and shortcuts' });
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await expect(dialog.getByRole('heading', { level: 3 })).toHaveText([
      'Move around',
      'View',
      'Present',
      'Share and print',
      'Help',
    ]);
    // Close and the scrollable list are the only stops: Tab stays inside the dialog.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('region', { name: 'Controls and shortcuts' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(live(page)).toHaveText('Slide 4 of 6: Trend');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(slide(page, 'Trend')).toBeFocused();
  });
  await test.step('b blacks out with a hint, Escape returns; l shows the laser chip, Escape removes it', async () => {
    await slide(page, 'Trend').focus();
    await page.keyboard.press('b');
    const black = stage(page).getByRole('button', { name: /^Screen blacked out/ });
    await expect(black).toBeFocused();
    await expect(black).toContainText('Press B or select');
    await page.keyboard.press('ArrowRight');
    await expect(live(page)).toHaveText('Slide 4 of 6: Trend');
    await page.keyboard.press('Escape');
    await expect(black).toHaveCount(0);
    await expect(slide(page, 'Trend')).toBeFocused();
    await page.keyboard.press('l');
    await expect(stage(page).locator('[data-tx-deck-laser]')).toContainText('Laser on');
    await expect(tool(page, 'Laser pointer')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(stage(page).locator('[data-tx-deck-laser]')).toHaveCount(0);
  });
  await test.step('the slide counter opens a listbox of titles; arrows and Enter jump to a slide', async () => {
    await tool(page, 'Choose a slide, 4 / 6').click();
    const list = page.getByRole('listbox', { name: 'Choose a slide' });
    await expect(list.getByRole('option', { selected: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(0);
    await expect(live(page)).toHaveText('Slide 5 of 6: Risks');
    await expect(slide(page, 'Risks')).toBeFocused();
  });
  await test.step('tab order runs through the toolbar groups, then the slide content', async () => {
    // WebKit's default Tab skips links and buttons (a macOS setting), so the
    // tab-order walk runs on Chromium and Pixel 7.
    if (browserName === 'webkit') return;
    await gotoFixture(page, 'slides-template-review');
    await page.getByRole('link', { name: 'All examples' }).focus();
    const order: string[] = [];
    for (let index = 0; index < 13; index += 1) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          return el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';
        })
      );
    }
    expect(order).toEqual([
      'Previous step or slide',
      'Choose a slide, 4 / 5',
      'Next step or slide',
      'First slide',
      'Last slide',
      'Overview of all slides',
      'Full screen',
      'Presenter view',
      'Black out the screen',
      'Laser pointer',
      'Copy link to this slide',
      'Print, one slide per page',
      'Controls and shortcuts',
    ]);
  });
  await test.step('single-key shortcuts act only while focus is inside the deck', async () => {
    await gotoFixture(page, 'slides-template-report');
    await page.getByRole('link', { name: 'All examples' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('o');
    await expect(live(page)).toHaveText('Slide 4 of 6: Trend');
    await expect(page.getByRole('navigation', { name: 'Slides' })).toHaveCount(0);
  });
  await test.step('arrow keys reveal and hide steps, and the announcement reports them', async () => {
    await gotoFixture(page, 'slides-fragments');
    await expect(live(page)).toHaveText('Slide 2 of 2: Launch plan, step 2 of 4');
    await slide(page, 'Launch plan').focus();
    await page.keyboard.press('ArrowRight');
    await expect(live(page)).toHaveText('Slide 2 of 2: Launch plan, step 3 of 4');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(live(page)).toHaveText('Slide 2 of 2: Launch plan, step 1 of 4');
    await expect(slide(page, 'Launch plan')).toBeFocused();
  });
  await test.step('fullscreen hides the toolbar behind an overlay that leaves and returns focus to the slide', async () => {
    await gotoFixture(page, 'slides-template-report');
    await tool(page, 'Full screen').click();
    await expect(stage(page)).toHaveAttribute('data-fullscreen', /^(native|viewport)$/);
    await expect(slide(page, 'Trend')).toBeFocused();
    await expect(controls(page)).toBeHidden();
    const overlay = stage(page).getByRole('group', { name: 'Full screen controls' });
    await expect(overlay).toContainText('4 / 6');
    await overlay.getByRole('button', { name: 'Next step or slide' }).click();
    await expect(live(page)).toHaveText('Slide 5 of 6: Risks');
    await overlay.getByRole('button', { name: 'Leave full screen' }).click();
    await expect(stage(page)).not.toHaveAttribute('data-fullscreen', /.+/);
    await expect(slide(page, 'Risks')).toBeFocused();
    await expect(controls(page)).toBeVisible();
  });
  await test.step('reduced motion marks the stage and cuts the chrome motion; full motion does not', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoFixture(page, 'slides-template-report');
    await tool(page, 'Next step or slide').click();
    await expect(live(page)).toHaveText('Slide 5 of 6: Risks');
    await expect(stage(page)).toHaveAttribute('data-motion', 'reduce');
    await tool(page, 'Black out the screen').click();
    const hint = stage(page).locator('.tx-deck-stage__blackout-hint');
    const duration = () =>
      hint.evaluate((el) => Number.parseFloat(getComputedStyle(el).transitionDuration));
    expect(await duration()).toBeLessThan(0.01);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await gotoFixture(page, 'slides-template-report');
    await expect(stage(page)).not.toHaveAttribute('data-motion', /.+/);
    await tool(page, 'Black out the screen').click();
    expect(await duration()).toBe(0.2);
  });
});

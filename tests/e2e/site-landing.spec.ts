import { expect, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com home (PLAN_006 T-44), in the browser: the four blueprint
 * sections mount in order with no islands inside the landing, the hero calls
 * to action and proof links are reachable, the install copy announces its
 * outcome, and the scroll reveal is opt-in motion (none under reduced
 * motion, never the hero). The counts, release copy and motion rules are
 * unit-tested in apps/website/tests/landing.test.ts; axe runs in the page sweep.
 */

const origin = serveDist();

test('sections in order, working calls to action, announced copy, motion only on opt-in', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${origin()}/`);
  await settle(page);
  const order = await page.$$eval('[data-tx-landing] > section', (sections) =>
    sections.map(
      (section) =>
        (section.hasAttribute('data-tx-home-hero') && 'hero') ||
        (section.hasAttribute('data-tx-home-pitch') && 'pitch') ||
        section.getAttribute('data-tx-home-story') ||
        (section.hasAttribute('data-tx-home-proof') && 'proof') ||
        (section.hasAttribute('data-tx-home-quickstart') && 'quickstart') ||
        (section.hasAttribute('data-tx-home-final') && 'final') ||
        'unknown'
    )
  );
  expect(order).toEqual([
    'hero',
    'pitch',
    'universal',
    'web-native',
    'brand',
    'agents',
    'accessible',
    'proof',
    'quickstart',
    'final',
  ]);
  // The stories alternate their art and grow their texel mark one cube per band.
  const stories = page.locator('[data-tx-home-story]');
  expect(
    await stories.evaluateAll((all) => all.map((story) => story.getAttribute('data-tx-art-side')))
  ).toEqual(['end', 'start', 'end', 'start', 'end']);
  expect(
    await stories.evaluateAll((all) =>
      all.map((story) => story.querySelectorAll('[data-tx-texel-mark] > *').length)
    )
  ).toEqual([1, 2, 3, 4, 5]);
  await expect(page.locator('[data-tx-landing] pre')).toHaveCount(0);
  await expect(page.locator('[data-tx-landing] [data-tx-illustration]')).toHaveCount(9);
  await expect(page.locator('[data-tx-hero-theme]')).toHaveCount(6);
  await expect(page.locator('[data-tx-landing] astro-island')).toHaveCount(0);
  const hero = page.locator('[data-tx-home-hero]');
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Build any interface.');
  const art = hero.locator('[data-tx-illustration="home-hero"]');
  await expect(art).toBeVisible();
  const box = await art.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(100);
  for (const name of ['Start building', 'Browse components', 'Web + native']) {
    const link = hero.getByRole('link', { name });
    await link.focus();
    await expect(link).toBeFocused();
  }
  const proof = hero.getByRole('list', { name: 'Texuli by the numbers' });
  for (const [id, href] of [
    ['components', '/component-pages/'],
    ['primitives', '/primitives-page/'],
    ['themes', '/gallery-themes/'],
    ['examples', '/examples/'],
  ] as const) {
    const stat = proof.locator(`[data-tx-hero-proof="${id}"] a`);
    await expect(stat).toHaveAttribute('href', href);
    await expect(stat).toHaveText(/^\s*\d+\s/);
  }

  const copy = hero.getByRole('button', { name: 'Copy install command' });
  await copy.focus();
  const status = hero.locator('[data-copy-command-status]');
  await expect(status).toHaveText('');
  await page.keyboard.press('Enter');
  // Either outcome is announced: copied (clipboard allowed) or failed (denied).
  await expect(status).toHaveText(/^(Command copied\.|Copy failed: )/);

  const animated = () =>
    page.$$eval('[data-tx-landing] > section', (sections) =>
      sections.map((section) => section.getAnimations().length)
    );
  expect((await animated()).every((count) => count === 0)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const counts = await animated();
  expect(counts[0]).toBe(0);
  if (await page.evaluate(() => CSS.supports('animation-timeline: view()')))
    expect(counts.slice(1).every((count) => count > 0)).toBe(true);
  expect(foreign).toEqual([]);
});

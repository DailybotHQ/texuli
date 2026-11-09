import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST, serveDist, settle } from './support/site.ts';

/** Detail pages built under one listing route: the truth a proof stat counts. */
const builtDetails = (route: string): number =>
  readdirSync(join(DIST, route), { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(join(DIST, route, entry.name, 'index.html'))
  ).length;

/*
 * texuli.com home (Home 2.2), in the browser: the nine bands mount in the storyboard order
 * (hero, pitch, Web & Native in the first half, Solutions, humans and agents, the brand
 * story, Built with Texuli, the accessible story with its proof row, the close) with no
 * islands inside the landing; the hero calls to action, status line and proof links are
 * reachable; the install copy announces its outcome; and the scroll reveal is opt-in
 * motion (none under reduced motion, never the hero). The order, counts, release copy and
 * motion rules are unit-tested in apps/website/tests/landing.test.ts; axe runs in the page
 * sweep.
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
        (section.hasAttribute('data-tx-home-web-native') && 'web-native') ||
        (section.hasAttribute('data-tx-home-solutions') && 'solutions') ||
        (section.hasAttribute('data-tx-home-agents') && 'agents') ||
        (section.hasAttribute('data-tx-home-built-with') && 'built-with') ||
        section.getAttribute('data-tx-home-story') ||
        (section.hasAttribute('data-tx-home-final') && 'final') ||
        'unknown'
    )
  );
  expect(order).toEqual([
    'hero',
    'pitch',
    'web-native',
    'solutions',
    'agents',
    'brand',
    'built-with',
    'accessible',
    'final',
  ]);
  // Web & Native sits in the first half of the page (§49.3).
  expect(order.indexOf('web-native')).toBeLessThan(order.length / 2);
  // The two kept stories alternate their art and grow their texel mark one cube per band.
  const stories = page.locator('[data-tx-home-story]');
  expect(
    await stories.evaluateAll((all) => all.map((story) => story.getAttribute('data-tx-art-side')))
  ).toEqual(['end', 'start']);
  expect(
    await stories.evaluateAll((all) =>
      all.map((story) => story.querySelectorAll('[data-tx-texel-mark] > *').length)
    )
  ).toEqual([1, 2]);
  // The accessible story carries the computed proof row (the merged proof band).
  const own = page.locator('[data-tx-home-story="accessible"]');
  for (const id of ['packages', 'blueprint', 'agent-safe'])
    await expect(own.locator(`[data-tx-proof="${id}"] a`)).toHaveText(/^\s*\d+\s/);
  await expect(page.locator('[data-tx-landing] pre')).toHaveCount(0);
  await expect(page.locator('[data-tx-landing] [data-tx-illustration]')).toHaveCount(9);
  await expect(page.locator('[data-tx-hero-theme]')).toHaveCount(6);
  await expect(page.locator('[data-tx-landing] astro-island')).toHaveCount(0);
  const hero = page.locator('[data-tx-home-hero]');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Build any interface.');
  const platforms = hero.getByRole('list', { name: 'Platform status' });
  await expect(platforms.locator('[data-tx-hero-status="web"]')).toContainText('available');
  await expect(platforms.locator('[data-tx-hero-status="native"]')).toContainText('in development');
  await expect(hero.locator('[data-tx-hero-news]')).toHaveAttribute('href', '/whats-new/');
  const art = hero.locator('[data-tx-illustration="home-hero"]');
  await expect(art).toBeVisible();
  const box = await art.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(100);
  for (const [name, href] of [
    ['Explore solutions', '/solutions/'],
    ['Explore native', '/native/'],
    ['Get started', '/guides/getting-started/'],
  ] as const) {
    const link = hero.getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
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
  // The counts are derived, never typed: each equals the detail pages built (PLAN_014).
  for (const [id, route] of [
    ['components', 'component-pages'],
    ['primitives', 'primitives-page'],
  ] as const) {
    const text = await proof.locator(`[data-tx-hero-proof="${id}"] a`).innerText();
    expect(Number.parseInt(text, 10), `${id} count`).toBe(builtDetails(route));
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

  // On a phone the hero art drops below the copy and calls to action.
  await page.setViewportSize({ width: 360, height: 800 });
  const cta = await hero.getByRole('link', { name: 'Explore solutions' }).boundingBox();
  const artBox = await art.boundingBox();
  expect(artBox?.y ?? 0).toBeGreaterThan((cta?.y ?? 0) + (cta?.height ?? 0));
  expect(artBox?.width ?? 0).toBeLessThanOrEqual(360);

  // Every band with art leads with its title and text on a phone: the pitch
  // and each story put the art below the copy, so the heading reads first.
  const bands = page.locator('[data-tx-home-pitch], [data-tx-home-story]');
  expect(await bands.count()).toBeGreaterThan(1);
  const bandBoxes = async () =>
    bands.evaluateAll((sections) =>
      sections.map((section) => {
        const copy = section.querySelector('[class$="__copy"]')?.getBoundingClientRect();
        const art = section.querySelector('[class$="__art"]')?.getBoundingClientRect();
        return {
          copyTop: copy?.top ?? 0,
          copyLeft: copy?.left ?? 0,
          artTop: art?.top ?? 0,
          artLeft: art?.left ?? 0,
        };
      })
    );
  for (const band of await bandBoxes()) expect(band.artTop).toBeGreaterThan(band.copyTop);

  // On a wide screen the pitch keeps its art in the first column.
  await page.setViewportSize({ width: 1280, height: 800 });
  const [pitch] = await bandBoxes();
  expect(pitch?.artLeft ?? 0).toBeLessThan(pitch?.copyLeft ?? 0);
});

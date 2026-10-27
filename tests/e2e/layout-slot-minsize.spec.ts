import { expect, test } from '@playwright/test';

/**
 * Screen slots shrink (FIX-layout-slot-minsize). Every layout and shell puts
 * the routed screen in a slot that is often a grid or flex item; with the
 * default `min-width: auto` such a slot grows to its content's minimum width,
 * so a wide table pushed a 390 px phone layout sideways. Each layout here
 * holds a screen with a fixed 600 px element in its own scroller: the layout
 * root and the page must not overflow, and the wide element scrolls inside.
 */

const LAYOUTS = [
  'sidebar',
  'rail',
  'top-nav',
  'dual-sidebar',
  'master-detail',
  'dashboard-grid',
  'docs',
  'blog',
  'editorial',
  'marketing',
  'mobile-tabs',
  'mobile-drawer',
  'wizard',
  'auth-split',
  'settings',
  'app-shell',
] as const;

test.use({ viewport: { width: 390, height: 844 } });

test('every layout: the screen slot shrinks to a 390 px phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Geometry at a fixed viewport: one engine is enough');
  test.setTimeout(LAYOUTS.length * 10_000);
  // One page session walks every layout (page setup dominates).
  for (const id of LAYOUTS) {
    await page.goto(`/?layout-slot=${id}`);
    const root = page.locator(`[data-slot-root="${id}"]`);
    await expect(root).toHaveAttribute('data-ready', 'true');
    const wide = root.locator('[data-slot-wide]');
    await expect(wide).toBeVisible();

    const box = await page.evaluate((layout) => {
      const rootNode = document.querySelector(`[data-slot-root="${layout}"]`) as HTMLElement;
      const screen = rootNode.querySelector('[data-slot-screen]') as HTMLElement;
      const wideNode = rootNode.querySelector('[data-slot-wide]') as HTMLElement;
      return {
        page: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        root: rootNode.scrollWidth,
        rootClient: rootNode.clientWidth,
        screen: screen.getBoundingClientRect().width,
        wide: wideNode.getBoundingClientRect().width,
      };
    }, id);

    // The wide element keeps its size; only its container scrolls.
    expect(box.wide, `${id}: wide element`).toBe(600);
    expect(box.page, `${id}: page overflows`).toBeLessThanOrEqual(box.viewport);
    expect(box.root, `${id}: layout root overflows`).toBeLessThanOrEqual(box.rootClient);
    expect(box.screen, `${id}: screen wider than the viewport`).toBeLessThanOrEqual(box.viewport);
  }
});

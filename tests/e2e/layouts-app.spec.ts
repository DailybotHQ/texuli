import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/*
 * Layouts and shells in a real browser, one page session:
 * - the app layouts example: responsive navigation, pane regions, RTL, the
 *   mobile drawer below the sidebar's minimum, axe in light and dark;
 * - AppNav takes its container's height, not the viewport's: inside a frame
 *   shorter than the viewport its sidebar footer stays inside the frame, and
 *   inside an app layout it still fills `--tx-app-height`;
 * - screen slots shrink (FIX-layout-slot-minsize): with the default
 *   `min-width: auto` a grid or flex slot grew to its content's minimum
 *   width, so a wide table pushed a 390 px phone layout sideways. Each layout
 *   holds a screen with a fixed 600 px element in its own scroller: the
 *   layout root and the page must not overflow, and the wide element scrolls
 *   inside.
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

test('layouts: app layouts respond and pass axe, AppNav fits its container, every screen slot shrinks on a phone', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await test.step('AppNav fits a frame shorter than the viewport and keeps its sidebar footer', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/?fixture=texuli-sidebar&mode=light');
    const frame = page.locator('[data-example="texuli-sidebar"] [data-axis="app-nav"]');
    await expect(frame).toBeVisible();
    const shell = frame.locator('.tx-app-nav');
    const collapse = frame.getByRole('button', { name: 'Collapse sidebar' });
    await expect(collapse).toBeVisible();

    const frameBox = await frame.boundingBox();
    const shellBox = await shell.boundingBox();
    const collapseBox = await collapse.boundingBox();
    if (!frameBox || !shellBox || !collapseBox) throw new Error('AppNav shell has no layout box');
    expect(frameBox.height).toBeLessThan(900);
    expect(shellBox.height).toBeLessThanOrEqual(frameBox.height);
    expect(collapseBox.y).toBeGreaterThanOrEqual(frameBox.y);
    expect(collapseBox.y + collapseBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height);
  });

  await test.step('AppNav still fills the app layout height beside short content', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/?fixture=texuli-app-layouts&mode=light');
    const layout = page.locator(
      '[data-example="texuli-app-layouts"] [data-tx-app-layout="sidebar"]'
    );
    await expect(layout).toBeVisible();
    const layoutBox = await layout.boundingBox();
    const sideBox = await layout.locator('.tx-app-nav__sidebar').boundingBox();
    if (!layoutBox || !sideBox) throw new Error('Sidebar layout has no layout box');
    expect(Math.abs(sideBox.height - layoutBox.height)).toBeLessThanOrEqual(2);
  });

  await test.step('app layouts render responsive navigation, pane regions and RTL without axe violations', async () => {
    const example = page.locator('[data-example="texuli-app-layouts"]');
    const layoutChoice = (label: string) => example.getByRole('button', { name: label });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/?fixture=texuli-app-layouts&mode=light');
    await expect(example.getByRole('heading', { name: 'App layouts' })).toBeVisible();
    await expect(example.locator('[data-tx-app-layout="sidebar"]')).toBeVisible();
    await layoutChoice('Top navigation').click();
    await expect(example.locator('[data-tx-app-layout="top-nav"]')).toBeVisible();
    await layoutChoice('Three-pane').click();
    await expect(example.locator('[data-tx-app-layout="three-pane"]')).toBeVisible();
    await expect(example.getByRole('complementary', { name: 'Context panel' })).toBeVisible();
    await expect(example.locator('[data-tx-layout-host]')).toHaveAttribute('dir', 'rtl');
    await layoutChoice('List and detail').click();
    await expect(example.getByRole('region', { name: 'Inbox threads' })).toBeVisible();
    await expect(example.getByRole('region', { name: 'Thread details' })).toBeVisible();
    const light = await new AxeBuilder({ page })
      .include('[data-example="texuli-app-layouts"]')
      .analyze();
    expect(light.violations).toEqual([]);

    await page.setViewportSize({ width: 390, height: 844 });
    await layoutChoice('Sidebar').click();
    // Below its 768px minimum the sidebar falls back to the mobile drawer
    // (layout catalog); the whole navigation stays one button away.
    await expect(example.locator('[data-tx-layout-host]')).toHaveAttribute(
      'data-layout',
      'mobile-drawer'
    );
    await expect(example.locator('[data-tx-layout="mobile-drawer"]')).toBeVisible();
    await example.getByRole('button', { name: 'Open navigation' }).click();
    const drawerNav = page.getByRole('navigation', { name: 'Harbor Notes' });
    await expect(drawerNav).toBeVisible();
    await expect(drawerNav.getByRole('link', { name: 'Mentions' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await page.keyboard.press('Escape');
    await expect(drawerNav).toBeHidden();
    await layoutChoice('Three-pane').click();
    await expect(example.locator('[data-tx-layout-host]')).toHaveAttribute('dir', 'rtl');

    await page.goto('/?fixture=texuli-app-layouts&mode=dark');
    await layoutChoice('List and detail').click();
    await expect(example.getByRole('region', { name: 'Inbox threads' })).toBeVisible();
    const dark = await new AxeBuilder({ page })
      .include('[data-example="texuli-app-layouts"]')
      .analyze();
    expect(dark.violations).toEqual([]);
  });

  await test.step('every layout: the screen slot shrinks to a 390 px phone', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
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
});

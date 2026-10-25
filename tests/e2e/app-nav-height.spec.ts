import { expect, test } from '@playwright/test';

/**
 * AppNav takes its container's height, not the viewport's. Inside a frame
 * shorter than the viewport (the sidebar example's 22rem AppNav shell) the
 * shell fits the frame and the sidebar footer stays inside it, so Collapse
 * sidebar is visible. Inside an app layout it still fills `--tx-app-height`.
 */

test('AppNav fits a frame shorter than the viewport and keeps its sidebar footer', async ({
  page,
}) => {
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

test('AppNav still fills the app layout height beside short content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?fixture=texuli-app-layouts&mode=light');
  const layout = page.locator('[data-example="texuli-app-layouts"] [data-tx-app-layout="sidebar"]');
  await expect(layout).toBeVisible();
  const layoutBox = await layout.boundingBox();
  const sideBox = await layout.locator('.tx-app-nav__sidebar').boundingBox();
  if (!layoutBox || !sideBox) throw new Error('Sidebar layout has no layout box');
  expect(Math.abs(sideBox.height - layoutBox.height)).toBeLessThanOrEqual(2);
});

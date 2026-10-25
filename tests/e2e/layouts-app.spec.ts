import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('app layouts render responsive navigation, pane regions, and RTL without axe violations', async ({
  page,
}) => {
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

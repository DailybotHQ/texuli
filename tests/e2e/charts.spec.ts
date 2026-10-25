import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('charts interaction', () => {
  test('keyboard exploration announces points and toggles series', async ({ page }) => {
    await page.goto('/?fixture=charts-interaction&mode=light');
    const host = page.locator('[data-example-host="charts-interaction"]');
    await expect(host).toBeVisible();

    await expect(host.getByRole('img', { name: /Signups and trials/ })).toBeVisible();
    const explorer = host.getByRole('application', { name: /Signups and trials/ });
    await expect(explorer).toBeVisible();
    await explorer.focus();

    const live = host.locator('[data-chart-live]');
    await expect(live).toContainText(/Signups.*Point 1 of/);

    await page.keyboard.press('ArrowRight');
    await expect(live).toContainText(/Point 2 of/);

    await page.keyboard.press('PageDown');
    await expect(live).toContainText(/Trials/);

    await expect(host.locator('[data-chart-tooltip]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(host.locator('[data-chart-tooltip]')).toHaveCount(0);

    const legend = host.getByRole('list', { name: 'Series' });
    await legend.getByRole('button', { name: 'Signups' }).click();
    await explorer.focus();
    await expect(live).toContainText(/Trials/);

    await host.getByRole('button', { name: 'Show data table' }).click();
    await expect(host.getByRole('table', { name: /Harbor Notes weekly signups/ })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('cartesian line chart is explorable out of the box', async ({ page }) => {
    await page.goto('/?fixture=charts-cartesian&mode=light');
    const host = page.locator('[data-example-host="charts-cartesian"]');
    await expect(host).toBeVisible();

    const figure = host.locator('figure[data-kind="line"]').first();
    await expect(figure).toBeVisible();
    await expect(figure.getByRole('img', { name: /Account growth/ })).toBeVisible();
    const explorer = figure.getByRole('application', { name: /Account growth/ });
    await expect(explorer).toBeVisible();
    await explorer.focus();

    const live = figure.locator('[data-chart-live]');
    await expect(live).toContainText(/New accounts.*Point 1 of/);
    await page.keyboard.press('ArrowRight');
    await expect(live).toContainText(/Point 2 of/);
    await page.keyboard.press('PageDown');
    await expect(live).toContainText(/Returning accounts/);

    const legend = figure.getByRole('list', { name: /Account growth series/ });
    await legend.getByRole('button', { name: 'New accounts' }).click();
    await explorer.focus();
    await expect(live).toContainText(/Returning accounts/);
    await expect(figure.locator('[data-line="new"]')).toHaveCount(0);
    await expect(figure.locator('[data-line="returning"]')).toHaveCount(1);

    await figure.getByRole('button', { name: 'Show data table' }).click();
    await expect(figure.getByRole('table', { name: /Account growth data/ })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('dark mode host stays usable', async ({ page }) => {
    await page.goto('/?fixture=charts-interaction&mode=dark');
    const host = page.locator('[data-example-host="charts-interaction"]');
    await expect(host.getByRole('img', { name: /Signups and trials/ })).toBeVisible();
    await expect(host.getByRole('application', { name: /Signups and trials/ })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});

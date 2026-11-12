import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

scenario(
  'dashboard-components',
  defineRows([
    {
      id: 'filter-chips-builder-clear',
      title:
        'applied filters are named removable chips; the builder adds conditions and clear resets them',
      async run({ page }) {
        if (!(await page.getByText('Region eq North').isVisible()))
          throw new Error('initial chip missing');
        if (!(await page.getByText('Unsaved changes').isVisible()))
          throw new Error('unsaved state missing');
        await page.getByRole('button', { name: 'Remove Region eq North' }).click();
        if (!(await page.locator('.tx-filter-bar__empty').isVisible()))
          throw new Error('remove did not clear the chip');
        await page.getByText('Add filter').click();
        const builder = page.locator('[data-tx-filter-builder]');
        if (!(await builder.isVisible())) throw new Error('add filter did not open the builder');
        await builder.getByRole('button', { name: 'Add condition' }).click();
        if (!(await builder.locator('[data-filter-path="r-0"]').isVisible()))
          throw new Error('builder did not add a condition');
        await page.locator('.tx-filter-bar__editor summary').click();
        await expect(builder).toBeHidden();
      },
    },
    {
      id: 'metric-card-states-and-a11y',
      title: 'metric cards expose the trend, an accessible sparkline, loading and empty states',
      async run({ page }) {
        const card = page.locator('[data-tx-component="data-metric-card"]').first();
        await expect(card.getByRole('heading', { name: 'Revenue' })).toBeVisible();
        await expect(card.getByText('$48,290')).toBeVisible();
        await expect(card.getByRole('img', { name: 'Revenue trend' })).toBeVisible();
        await expect(card.getByText('12%')).toBeVisible();
        await expect(page.getByText('Loading forecast'), 'loading state').toBeVisible();
        await expect(page.getByText('No data for this period')).toBeVisible();
        const axe = await new AxeBuilder({ page })
          .include('[data-tx-filter-bar]')
          .include('[data-tx-component="data-metric-card"]')
          .analyze();
        if (axe.violations.length) {
          throw new Error(
            `accessibility violations: ${axe.violations.map((violation) => `${violation.id} (${violation.nodes.length})`).join(', ')}`
          );
        }
      },
    },
  ])
);

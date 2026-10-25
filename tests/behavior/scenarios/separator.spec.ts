import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

const scenarioRoot = (page: import('@playwright/test').Page) =>
  page.locator('[data-behavior="scenario"]');

scenario(
  'separator',
  defineRows([
    {
      id: 'decorative-hidden',
      title: 'a decorative separator is not announced',
      async run({ page }) {
        // Two semantic separators are exposed; the decorative one is not.
        await expect(scenarioRoot(page).getByRole('separator')).toHaveCount(2);
      },
    },
    {
      id: 'horizontal',
      title: 'a semantic separator is horizontal by default',
      async run({ page }) {
        const separators = scenarioRoot(page).getByRole('separator');
        await expect(separators.first()).not.toHaveAttribute('aria-orientation', 'vertical');
      },
    },
    {
      id: 'vertical',
      title: 'a vertical separator says so',
      async run({ page }) {
        await expect(scenarioRoot(page).getByRole('separator').last()).toHaveAttribute(
          'aria-orientation',
          'vertical'
        );
      },
    },
    {
      id: 'not-focusable',
      title: 'a static separator never takes focus',
      async run({ page }) {
        const focusable = await page.locator('[data-behavior-separator]').evaluateAll((nodes) =>
          nodes.map((node) => {
            (node as HTMLElement).focus();
            return node.ownerDocument.activeElement === node;
          })
        );
        expect(focusable).toEqual([false, false, false]);
      },
    },
  ])
);

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { behaviorEvents, focusedElement } from '../harness/oracle.ts';

const node = (page: Page, name: string) => page.getByRole('group', { name, exact: true });

scenario(
  'workflow-editor',
  defineRows([
    {
      id: 'keyboard-moves-connects-and-edits-the-outline',
      title:
        'workflow editor: arrows move focus, Alt+Arrow nudges and undoes, Enter on a port connects, and the treegrid outline renames',
      projects: ['chromium', 'webkit'],
      async run({ page }) {
        await node(page, 'Expense request').focus();
        await page.keyboard.press('ArrowRight');
        await expect
          .poll(() => focusedElement(page))
          .toEqual({ role: 'group', name: 'Team lead review' });
        const lead = node(page, 'Team lead review');
        const before = await lead.boundingBox();
        await page.keyboard.press('Alt+ArrowDown');
        await expect
          .poll(async () => (await lead.boundingBox())?.y)
          .toBeGreaterThan(before?.y ?? 0);
        await page.keyboard.press('ControlOrMeta+z');
        await expect.poll(async () => (await lead.boundingBox())?.y).toBeCloseTo(before?.y ?? 0, 0);

        // Connect mode: Enter on the free "Rejected" port, arrows choose, Enter connects.
        await lead.getByRole('button', { name: 'Rejected output of Team lead review' }).focus();
        await page.keyboard.press('Enter');
        await expect
          .poll(() => focusedElement(page))
          .toEqual({ role: 'button', name: 'Input input of Closed' });
        await page.keyboard.press('Escape');
        await expect
          .poll(() => focusedElement(page))
          .toEqual({ role: 'button', name: 'Rejected output of Team lead review' });
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await behaviorEvents(page)).length).toBeGreaterThan(2);

        // The treegrid outline shows the new connection and renames without the canvas.
        const outline = page.getByRole('treegrid', { name: 'Workflow outline' });
        const row = outline.getByRole('row', { name: /Team lead review/ });
        await row.focus();
        await page.keyboard.press('ArrowRight');
        await expect(outline.getByRole('row', { name: /Rejected to Input, Closed/ })).toBeVisible();
        await page.keyboard.press('F2');
        await page.getByRole('textbox', { name: 'Rename Team lead review' }).fill('Finance review');
        await page.keyboard.press('Enter');
        await expect(node(page, 'Finance review')).toBeVisible();
      },
    },
    {
      id: 'pointer-drag-and-axe-in-light-and-dark',
      title:
        'workflow editor: a pointer drag moves a node, and the editor passes axe in light and dark',
      projects: ['chromium', 'webkit'],
      async run({ page }) {
        const paid = node(page, 'Paid');
        const box = await paid.boundingBox();
        if (!box) throw new Error('no box');
        await page.mouse.move(box.x + box.width / 2, box.y + 12);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 40, box.y + 52, { steps: 6 });
        await page.mouse.up();
        await expect
          .poll(async () => (await paid.boundingBox())?.y ?? 0)
          .toBeGreaterThan(box.y + 20);

        for (const scheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          const results = await new AxeBuilder({ page })
            .include('.tx-workflow-editor')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(results.violations.map((violation) => violation.id)).toEqual([]);
        }

        if (process.env.TEXULI_PERF === '1') {
          // 500 nodes and 2,000 edges: a 50-node drag frame (update and render) stays under a 16 ms frame.
          await page.goto('/?behavior=workflow-editor&size=large');
          await expect(page.locator('html[data-behavior-ready="true"]')).toHaveCount(1);
          await expect(page.locator('[data-wf-node]')).toHaveCount(500);
          const frames = await page.evaluate(() =>
            (window as unknown as { __workflowBench: () => number[] }).__workflowBench()
          );
          const sorted = [...frames].sort((a, b) => a - b);
          const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
          console.log(
            `[perf] browser drag frame 50 of 500: p75 ${p75.toFixed(1)} ms, max ${Math.max(...frames).toFixed(1)} ms`
          );
          expect(p75).toBeLessThan(16);
        }
      },
    },
  ])
);

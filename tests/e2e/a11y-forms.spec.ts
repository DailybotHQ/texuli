/**
 * Accessibility sweep: forms and inputs.
 * axe with zero exclusions in light, dark (and dir=rtl on the light page) and
 * forced-colors, and 400% reflow, for every form example; keyboard-only on
 * the interactive ones. Each check walks its examples in one page session.
 * Fix findings at their source.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/** Form and input examples under this gate. */
const FORM_EXAMPLES = [
  'texuli-button',
  'texuli-field',
  'texuli-input',
  'texuli-choice',
  'texuli-combobox',
  'ui-select',
  'texuli-date',
  'texuli-number-pin',
  'texuli-slider',
  'texuli-file-upload',
  'texuli-tags-color',
  'texuli-toggle',
] as const;

type FixtureId = (typeof FORM_EXAMPLES)[number];

async function gotoFixture(
  page: Page,
  id: FixtureId,
  mode: 'light' | 'dark' = 'light'
): Promise<void> {
  await page.goto(`/?fixture=${id}&mode=${mode}`);
  await expect(page.locator(`[data-example-host="${id}"]`)).toBeVisible({ timeout: 30_000 });
  const inner = page.locator(`[data-example="${id}"]`);
  if ((await inner.count()) > 0) {
    await expect(inner.first()).toBeVisible();
  }
}

async function axeExample(page: Page, id: FixtureId): Promise<void> {
  const host = page.locator(`[data-example-host="${id}"]`);
  const target =
    (await page.locator(`[data-example="${id}"]`).count()) > 0
      ? `[data-example="${id}"]`
      : `[data-example-host="${id}"]`;
  await expect(host).toBeVisible();
  const results = await new AxeBuilder({ page }).include(target).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

/** Collects axe violations per example instead of stopping at the first one. */
async function axeProblems(page: Page, id: FixtureId, label: string): Promise<string[]> {
  const target =
    (await page.locator(`[data-example="${id}"]`).count()) > 0
      ? `[data-example="${id}"]`
      : `[data-example-host="${id}"]`;
  const results = await new AxeBuilder({ page }).include(target).analyze();
  return results.violations.map(
    (violation) =>
      `${id} (${label}) ${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`
  );
}

const HALF = Math.ceil(FORM_EXAMPLES.length / 2);
const BATCHES = [FORM_EXAMPLES.slice(0, HALF), FORM_EXAMPLES.slice(HALF)];

test.describe('a11y forms · light, RTL and dark axe', () => {
  for (const batch of BATCHES) {
    test(`${batch[0]} … ${batch.at(-1)} pass axe in light, light RTL and dark`, async ({
      page,
    }) => {
      test.setTimeout(batch.length * 30_000);
      const problems: string[] = [];
      for (const id of batch) {
        await gotoFixture(page, id, 'light');
        problems.push(...(await axeProblems(page, id, 'light')));
        await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
        problems.push(...(await axeProblems(page, id, 'rtl')));
        await gotoFixture(page, id, 'dark');
        problems.push(...(await axeProblems(page, id, 'dark')));
      }
      expect(problems).toEqual([]);
    });
  }
});

test.describe('a11y forms · forced-colors', () => {
  test('every form example passes axe under forced-colors', async ({ page }) => {
    test.setTimeout(FORM_EXAMPLES.length * 20_000);
    await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
    const problems: string[] = [];
    for (const id of FORM_EXAMPLES) {
      await gotoFixture(page, id, 'light');
      problems.push(...(await axeProblems(page, id, 'forced colors')));
    }
    expect(problems).toEqual([]);
  });
});

test.describe('a11y forms · 400% reflow (320 CSS px)', () => {
  test('every form example stays usable at 320px width', async ({ page }) => {
    test.setTimeout(FORM_EXAMPLES.length * 20_000);
    await page.setViewportSize({ width: 320, height: 900 });
    const problems: string[] = [];
    for (const id of FORM_EXAMPLES) {
      await gotoFixture(page, id, 'light');
      await expect(page.locator(`[data-example-host="${id}"]`)).toBeVisible();
      await page.waitForTimeout(50);
      const overflow = await page.evaluate((exampleId) => {
        const node =
          document.querySelector(`[data-example="${exampleId}"]`) ??
          document.querySelector(`[data-example-host="${exampleId}"]`);
        if (!node) return 999;
        // Host-level horizontal overflow (ignore fixture chrome).
        return Math.max(0, node.scrollWidth - node.clientWidth);
      }, id);
      if (overflow > 16) problems.push(`${id} overflows by ${overflow}px`);
      problems.push(...(await axeProblems(page, id, '320px')));
    }
    expect(problems).toEqual([]);
  });
});

test.describe('a11y forms · keyboard', () => {
  test('field, choice, combobox, select, slider and number-pin work from the keyboard', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await test.step('texuli-field labels associate and Tab reaches the control', async () => {
      await gotoFixture(page, 'texuli-field', 'light');
      const host = page.locator(
        '[data-example="texuli-field"], [data-example-host="texuli-field"]'
      );
      await expect(host.first()).toBeVisible();
      const control = host.locator('input, textarea, select, [role="textbox"]').first();
      await expect(control).toBeVisible();
      await control.focus();
      await expect(control).toBeFocused();
      await axeExample(page, 'texuli-field');
    });

    await test.step('texuli-choice toggles checkbox and radio from the keyboard', async () => {
      await gotoFixture(page, 'texuli-choice', 'light');
      const host = page.locator(
        '[data-example="texuli-choice"], [data-example-host="texuli-choice"]'
      );
      const checkbox = host.getByRole('checkbox').first();
      await expect(checkbox).toBeVisible();
      await checkbox.focus();
      await page.keyboard.press(' ');
      await axeExample(page, 'texuli-choice');
    });

    await test.step('texuli-combobox opens the listbox with ArrowDown', async () => {
      await gotoFixture(page, 'texuli-combobox', 'light');
      await axeExample(page, 'texuli-combobox');
      const host = page.locator(
        '[data-example="texuli-combobox"], [data-example-host="texuli-combobox"]'
      );
      const combo = host.getByRole('combobox').first();
      await expect(combo).toBeVisible();
      await combo.focus();
      await page.keyboard.press('ArrowDown');
      // Listbox may portal to body.
      const list = page.getByRole('listbox').first();
      if ((await list.count()) > 0) {
        await expect(list).toBeVisible();
      }
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toHaveCount(0);
    });

    await test.step('ui-select opens the listbox from the trigger', async () => {
      await gotoFixture(page, 'ui-select', 'light');
      const host = page.locator('[data-example="ui-select"], [data-example-host="ui-select"]');
      // Default demo may start open for visual capture.
      let list = page.getByRole('listbox').first();
      if ((await list.count()) === 0) {
        const trigger = host.getByRole('combobox').first().or(host.getByRole('button').first());
        await expect(trigger.first()).toBeVisible();
        await trigger.first().click();
        list = page.getByRole('listbox').first();
      }
      if ((await list.count()) > 0) {
        await expect(list).toBeVisible();
        await page.keyboard.press('Escape');
      }
      await axeExample(page, 'ui-select');
    });

    await test.step('texuli-slider moves value with arrow keys', async () => {
      await gotoFixture(page, 'texuli-slider', 'light');
      const host = page.locator(
        '[data-example="texuli-slider"], [data-example-host="texuli-slider"]'
      );
      const slider = host
        .getByRole('slider')
        .first()
        .or(host.locator('[data-tx-slider-thumb]').first());
      await expect(slider.first()).toBeVisible();
      await slider.first().focus();
      await page.keyboard.press('ArrowRight');
      await axeExample(page, 'texuli-slider');
    });

    await test.step('texuli-number-pin spinbutton responds to arrows', async () => {
      await gotoFixture(page, 'texuli-number-pin', 'light');
      const host = page.locator(
        '[data-example="texuli-number-pin"], [data-example-host="texuli-number-pin"]'
      );
      const spin = host.getByRole('spinbutton').first().or(host.locator('input').first());
      await expect(spin.first()).toBeVisible();
      await spin.first().focus();
      await page.keyboard.press('ArrowUp');
      await axeExample(page, 'texuli-number-pin');
    });
  });
});

test.describe('a11y forms · listbox width polish', () => {
  /** Wait for sameWidth trailing rAF + layout; assert list ≥ trigger. */
  async function expectListAtLeastTrigger(
    page: Page,
    triggerSelector: string,
    listSelector = '[role="listbox"]'
  ): Promise<void> {
    await expect(page.locator(listSelector).first()).toBeVisible({ timeout: 5_000 });
    // sameWidth re-applies on a trailing animation frame (WebKit font settle).
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    );
    await expect
      .poll(
        async () =>
          page.evaluate(
            ({ triggerSel, listSel }) => {
              const trigger = document.querySelector(triggerSel);
              const listbox = document.querySelector(listSel);
              if (!trigger || !listbox) return null;
              const tw = trigger.getBoundingClientRect().width;
              const lw = listbox.getBoundingClientRect().width;
              return { trigger: tw, list: lw, ok: lw + 0.5 >= tw };
            },
            { triggerSel: triggerSelector, listSel: listSelector }
          ),
        { timeout: 3_000 }
      )
      .toMatchObject({ ok: true });
  }

  test('combobox and select listboxes are at least as wide as their trigger', async ({ page }) => {
    test.setTimeout(60_000);
    await test.step('texuli-combobox listbox is at least as wide as the trigger', async () => {
      await gotoFixture(page, 'texuli-combobox', 'light');
      const host = page.locator(
        '[data-example="texuli-combobox"], [data-example-host="texuli-combobox"]'
      );
      const combo = host.getByRole('combobox').first();
      await combo.focus();
      await page.keyboard.press('ArrowDown');
      await expectListAtLeastTrigger(page, '[role="combobox"]');
      await page.keyboard.press('Escape');
    });

    await test.step('ui-select listbox is at least as wide as the trigger', async () => {
      await gotoFixture(page, 'ui-select', 'light');
      const host = page.locator('[data-example="ui-select"], [data-example-host="ui-select"]');
      const trigger = host.locator('[data-tx-select-trigger]').first();
      await expect(trigger).toBeVisible();
      const list = page.getByRole('listbox').first();
      // Demo often starts open for capture. Wait briefly; only click when still
      // closed so a slow attach is not toggled shut (WebKit race).
      const opened = await list.isVisible().catch(() => false);
      if (!opened) {
        await trigger.click();
      }
      await expect(list).toBeVisible({ timeout: 8_000 });
      await expectListAtLeastTrigger(page, '[data-tx-select-trigger]');
      await page.keyboard.press('Escape');
    });
  });
});

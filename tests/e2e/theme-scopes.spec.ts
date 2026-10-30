import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

/*
 * T-scope-portals (ADR-023): two subtrees themed with `applyTheme(el)` side by
 * side (tests/fixtures/app/theme-scopes.html), on a page with a third theme.
 * Every overlay kind keeps its own subtree's theme: the dialog (portaled to a
 * scoped portal root at the end of body), and the menu, select, tooltip and
 * toast (rendered in place, in the top layer). The expected colors come from a
 * probe: a shallow copy of the overlay element (same classes and attributes)
 * placed inside the subtree, so the check needs no knowledge of which token
 * each component reads.
 */

type ScopeId = 'a' | 'b';
type Kind = 'dialog' | 'menu' | 'select' | 'tooltip';
type Colors = { bg: string; fg: string };

declare global {
  interface Window {
    txScopes: Record<
      ScopeId,
      {
        set: (kind: Kind, open: boolean) => void;
        toast: (title: string) => void;
        toggleMode: () => void;
      }
    >;
  }
}

const LABEL: Record<ScopeId, string> = { a: 'Clinic', b: 'Arcade' };

async function open(page: Page, mode: 'light' | 'dark'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: mode });
  await page.goto(`/theme-scopes.html?mode=${mode}`);
  await expect(page.locator('[data-scope="a"][data-tx-scope]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-scope="b"][data-tx-scope]')).toBeVisible();
}

/** The open overlay of `kind` that belongs to subtree `id`. */
function overlay(page: Page, id: ScopeId, kind: Kind | 'toast'): Locator {
  const label = LABEL[id];
  switch (kind) {
    case 'dialog':
      return page.getByRole('dialog', { name: `${label} dialog` });
    case 'menu':
      // Named by its trigger (aria-labelledby); rendered in place in the top layer.
      return page.locator(`[data-scope="${id}"] [role="menu"]`);
    case 'select':
      return page.locator(`[data-scope="${id}"] [data-tx-select-content]`);
    case 'tooltip':
      return page.getByRole('tooltip').filter({ hasText: `${label} tip` });
    case 'toast':
      return page.locator(`[data-scope="${id}"] .tx-toast`).filter({ hasText: `${label} saved` });
  }
}

async function setOpen(page: Page, id: ScopeId, kind: Kind, value: boolean): Promise<void> {
  await page.evaluate(([scope, k, v]) => window.txScopes[scope].set(k, v), [id, kind, value] as [
    ScopeId,
    Kind,
    boolean,
  ]);
}

async function colorsOf(locator: Locator): Promise<Colors> {
  return locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return { bg: style.backgroundColor, fg: style.color };
  });
}

/** The colors the overlay element would have rendered inside subtree `id`. */
async function probe(page: Page, locator: Locator, id: ScopeId): Promise<Colors> {
  const handle = await locator.elementHandle();
  return page.evaluate(
    ([node, scopeId]) => {
      const scope = document.querySelector(`[data-scope="${scopeId}"]`);
      if (!(node instanceof HTMLElement) || !scope) throw new Error('missing node or scope');
      const copy = node.cloneNode(false) as HTMLElement;
      for (const name of ['id', 'popover', 'role', 'aria-label', 'aria-labelledby']) {
        copy.removeAttribute(name);
      }
      copy.style.position = 'static';
      copy.setAttribute('aria-hidden', 'true');
      scope.append(copy);
      const style = getComputedStyle(copy);
      const colors = { bg: style.backgroundColor, fg: style.color };
      copy.remove();
      return colors;
    },
    [handle, id] as const
  );
}

/** The overlay of subtree `id` shows its own theme's colors, not the other subtree's. */
async function expectOwnTheme(
  page: Page,
  id: ScopeId,
  kind: Kind | 'toast',
  { distinct = true } = {}
): Promise<Colors> {
  const target = overlay(page, id, kind);
  await expect(target).toBeVisible();
  const own = await probe(page, target, id);
  if (distinct) {
    // The subtrees are in opposite modes here, so their colors must differ.
    const foreign = await probe(page, target, id === 'a' ? 'b' : 'a');
    expect(own, `${kind} probes differ between subtrees`).not.toEqual(foreign);
  }
  await expect.poll(() => colorsOf(target), { message: `${kind} in ${id}` }).toEqual(own);
  return own;
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    )
  );
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .include('[data-scope]')
    .include('[data-tx-portal-root]')
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

for (const mode of ['light', 'dark'] as const) {
  test(`every overlay keeps its own subtree's theme (page ${mode})`, async ({ page }) => {
    await open(page, mode);
    // One subtree is dark in every run.
    await expect(page.locator('[data-scope][data-tx-mode="dark"]')).toHaveCount(1);

    for (const id of ['a', 'b'] as const) {
      await test.step(`dialog in ${id}`, async () => {
        await setOpen(page, id, 'dialog', true);
        await expectOwnTheme(page, id, 'dialog');
        // It lives in a scoped portal root, not inside the subtree and not bare in body.
        const root = overlay(page, id, 'dialog').locator('xpath=ancestor::*[@data-tx-portal-root]');
        await expect(root).toHaveAttribute(
          'data-tx-theme',
          id === 'a' ? 'health-clinic' : 'gaming-neon'
        );
        await page.keyboard.press('Escape');
        await expect(overlay(page, id, 'dialog')).toBeHidden();
      });
    }

    for (const kind of ['menu', 'select', 'tooltip'] as const) {
      await test.step(`${kind} in both`, async () => {
        await setOpen(page, 'a', kind, true);
        await setOpen(page, 'b', kind, true);
        await expectOwnTheme(page, 'a', kind);
        await expectOwnTheme(page, 'b', kind);
        await setOpen(page, 'a', kind, false);
        await setOpen(page, 'b', kind, false);
      });
    }

    await test.step('toasts in both', async () => {
      await page.evaluate(() => {
        window.txScopes.a.toast('Clinic saved');
        window.txScopes.b.toast('Arcade saved');
      });
      await expectOwnTheme(page, 'a', 'toast');
      await expectOwnTheme(page, 'b', 'toast');
    });
  });

  test(`axe on both subtrees with their overlays open (page ${mode})`, async ({ page }) => {
    await open(page, mode);
    await page.evaluate(() => {
      window.txScopes.a.toast('Clinic saved');
      window.txScopes.b.toast('Arcade saved');
    });
    for (const kind of ['menu', 'tooltip'] as const) {
      await setOpen(page, 'a', kind, true);
      await setOpen(page, 'b', kind, true);
    }
    await expect(overlay(page, 'a', 'menu')).toBeVisible();
    await expect(overlay(page, 'b', 'tooltip')).toBeVisible();
    await expectNoAxeViolations(page);
    for (const kind of ['menu', 'tooltip'] as const) {
      await setOpen(page, 'a', kind, false);
      await setOpen(page, 'b', kind, false);
    }
    for (const id of ['a', 'b'] as const) {
      await setOpen(page, id, 'select', true);
      await expect(overlay(page, id, 'select')).toBeVisible();
      await expectNoAxeViolations(page);
      await setOpen(page, id, 'select', false);
      await setOpen(page, id, 'dialog', true);
      await expect(overlay(page, id, 'dialog')).toBeVisible();
      await expectNoAxeViolations(page);
      await setOpen(page, id, 'dialog', false);
      await expect(overlay(page, id, 'dialog')).toBeHidden();
    }
  });
}

test('toggling a subtree theme updates its open menu and dialog', async ({ page }) => {
  await open(page, 'light');
  await setOpen(page, 'a', 'menu', true);
  const before = await expectOwnTheme(page, 'a', 'menu');
  await page.evaluate(() => window.txScopes.a.toggleMode());
  await expect(page.locator('[data-scope="a"]')).toHaveAttribute('data-tx-mode', 'dark');
  await expect(overlay(page, 'a', 'menu')).toBeVisible();
  // Both subtrees are dark now: compare with the menu before the toggle instead.
  const after = await expectOwnTheme(page, 'a', 'menu', { distinct: false });
  expect(after).not.toEqual(before);
  await setOpen(page, 'a', 'menu', false);

  // The portaled dialog follows a change made while it is open (the root mirrors it).
  await setOpen(page, 'a', 'dialog', true);
  const dark = await expectOwnTheme(page, 'a', 'dialog', { distinct: false });
  await page.evaluate(() => window.txScopes.a.toggleMode());
  await expect(page.locator('[data-scope="a"]')).toHaveAttribute('data-tx-mode', 'light');
  const light = await expectOwnTheme(page, 'a', 'dialog');
  expect(light).not.toEqual(dark);
  await expect(
    overlay(page, 'a', 'dialog').locator('xpath=ancestor::*[@data-tx-portal-root]')
  ).toHaveAttribute('data-tx-mode', 'light');
});

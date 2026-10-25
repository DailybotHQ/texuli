import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const coreUrl = `/@fs${resolve(process.cwd(), 'packages/core/src')}`;

test('R16: a toast stays reachable and announced above nested modals', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(async (coreBase) => {
    const [{ createOverlay }, { getInertRegistry }, { createAnnouncer }] = await Promise.all([
      import(`${coreBase}/overlay/index.ts`),
      import(`${coreBase}/inert/index.ts`),
      import(`${coreBase}/announcer/index.ts`),
    ]);

    const style = document.createElement('style');
    style.textContent = `
      #r16-dialog, #r16-inner { position: fixed; inset: 20%; padding: 2rem; background: white; }
      #r16-dialog[data-state="closed"], #r16-inner[data-state="closed"] { display: none; }
      #r16-toasts { position: fixed; inset-block-start: 1rem; inset-block-end: auto; inset-inline-start: auto; inset-inline-end: 1rem; inline-size: max-content; margin: 0; padding: 1rem; background: white; }
    `;
    document.head.append(style);

    const trigger = document.createElement('button');
    trigger.id = 'r16-trigger';
    trigger.textContent = 'Open preferences';
    document.body.append(trigger);

    const toasts = document.createElement('section');
    toasts.id = 'r16-toasts';
    toasts.setAttribute('popover', 'manual');
    toasts.setAttribute('role', 'region');
    toasts.setAttribute('aria-label', 'Notifications');
    const toastAction = document.createElement('button');
    toastAction.id = 'r16-toast-action';
    toastAction.textContent = 'Undo saved file';
    toasts.append(toastAction);
    document.body.append(toasts);
    toastAction.addEventListener('click', () => toasts.hidePopover());

    const dialog = document.createElement('section');
    dialog.id = 'r16-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Preferences');
    dialog.setAttribute('data-state', 'closed');
    const innerTrigger = document.createElement('button');
    innerTrigger.id = 'r16-inner-trigger';
    innerTrigger.textContent = 'Open advanced preferences';
    dialog.append(innerTrigger);
    document.body.append(dialog);

    const inner = document.createElement('section');
    inner.id = 'r16-inner';
    inner.setAttribute('role', 'dialog');
    inner.setAttribute('aria-modal', 'true');
    inner.setAttribute('aria-label', 'Advanced preferences');
    inner.setAttribute('data-state', 'closed');
    inner.setAttribute('popover', 'manual');
    const innerFocus = document.createElement('button');
    innerFocus.textContent = 'Advanced option';
    inner.append(innerFocus);
    document.body.append(inner);

    const inert = getInertRegistry();
    inert.exempt({ element: toasts, label: 'toast-region' });
    const announcer = createAnnouncer({ document, dedupeMs: 0 });
    announcer.ensure();
    announcer.announce('File saved. Undo is available.', { immediate: true });

    if (typeof toasts.showPopover !== 'function') {
      throw new Error('R16 requires native manual popover support in the browser');
    }
    toasts.showPopover();

    let focusStartedAt: number | null = null;
    let openToFocusMs: number | null = null;
    dialog.addEventListener('focusin', (event) => {
      if (event.target === innerTrigger && focusStartedAt !== null) {
        openToFocusMs = performance.now() - focusStartedAt;
        focusStartedAt = null;
      }
    });
    const outer = createOverlay({
      element: dialog,
      modal: true,
      label: 'preferences',
      initialFocus: innerTrigger,
      inertRegistry: inert,
      presence: { reducedMotion: true },
    });
    trigger.addEventListener('click', (event) => {
      focusStartedAt = performance.now();
      outer.open(event);
    });
    const nested = createOverlay({
      element: inner,
      modal: true,
      label: 'advanced-preferences',
      initialFocus: innerFocus,
      inertRegistry: inert,
      presence: { reducedMotion: true },
    });
    innerTrigger.addEventListener('click', (event) => nested.open(event));

    // This is the toast host's documented cross-modal keyboard entry point.
    // The spike isolates its interaction with the actual overlay and announcer texels.
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'F6') return;
        event.preventDefault();
        toastAction.focus();
      },
      true
    );

    Object.assign(window, {
      __r16Probe: {
        outer,
        nested,
        announcer,
        getOpenToFocusMs: () => openToFocusMs,
      },
    });
  }, coreUrl);

  await page.getByRole('button', { name: 'Open preferences' }).click();
  const modal = page.getByRole('dialog', { name: 'Preferences', exact: true });
  await expect(modal).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('File saved. Undo is available.');

  await page.keyboard.press('F6');
  const toastAction = page.getByRole('button', { name: 'Undo saved file' });
  await expect(toastAction).toBeFocused();
  await toastAction.click();

  await page.getByRole('button', { name: 'Open advanced preferences' }).click();
  const nested = page.getByRole('dialog', { name: 'Advanced preferences' });
  await expect(nested).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(nested).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open advanced preferences' })).toBeFocused();
  await expect(modal).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open preferences' })).toBeFocused();

  const openToFocusMs = await page.evaluate(() =>
    (
      window as unknown as { __r16Probe: { getOpenToFocusMs: () => number | null } }
    ).__r16Probe.getOpenToFocusMs()
  );
  expect(openToFocusMs).not.toBeNull();
  console.info(`R16 open-to-focus: ${openToFocusMs?.toFixed(2)} ms`);
});

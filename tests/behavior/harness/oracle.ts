/**
 * The oracle: what a row may observe. Roles, accessible names, states, the
 * focus sequence, Escape, outside pointer and focus, emitted events, scroll
 * lock and inertness. Never DOM shape or class names: a row asserts what a
 * user (or assistive technology) can tell, not how the markup is built.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import type { BehaviorEvent } from './client/events.ts';

/** Opens a primitive's scenario and waits until it has mounted. */
export async function gotoScenario(page: Page, primitive: string): Promise<void> {
  await page.goto(`/?behavior=${encodeURIComponent(primitive)}`);
  await expect(
    page.locator('html[data-behavior-ready="true"], html[data-behavior-error="true"]')
  ).toHaveCount(1);
  const error = await page.locator('html').getAttribute('data-behavior-error');
  if (error) throw new Error(await page.getByRole('alert').innerText());
}

export interface FocusedElement {
  /** The ARIA role, as the accessibility tree reports it (`none` for no focus). */
  role: string;
  /** The accessible name ('' when unnamed). */
  name: string;
}

const SNAPSHOT_LINE = /^- ([a-z]+)(?: "((?:[^"\\]|\\.)*)")?/;

/** The role and accessible name of what has focus, from the accessibility tree. */
export async function focusedElement(page: Page): Promise<FocusedElement> {
  const focused = page.locator('*:focus');
  if ((await focused.count()) === 0) return { role: 'none', name: '' };
  const snapshot = await focused.first().ariaSnapshot();
  const match = SNAPSHOT_LINE.exec(snapshot.split('\n')[0] ?? '');
  return { role: match?.[1] ?? 'generic', name: (match?.[2] ?? '').replace(/\\(.)/g, '$1') };
}

/** Presses Tab (or Shift+Tab) `presses` times and records each focus stop. */
export async function focusSequence(
  page: Page,
  presses: number,
  options: { reverse?: boolean } = {}
): Promise<FocusedElement[]> {
  const stops: FocusedElement[] = [];
  for (let index = 0; index < presses; index += 1) {
    await page.keyboard.press(options.reverse ? 'Shift+Tab' : 'Tab');
    stops.push(await focusedElement(page));
  }
  return stops;
}

/** Whether focus is inside `container` right now. */
export function focusIsWithin(container: Locator): Promise<boolean> {
  return container.evaluate((element) => element.contains(element.ownerDocument.activeElement));
}

/**
 * Whether an element is inert to the user: focus cannot land on it. A
 * non-focusable element is probed with a temporary `tabindex`, restored after.
 */
export function isInert(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const html = element as HTMLElement;
    const before = html.ownerDocument.activeElement as HTMLElement | null;
    const hadTabindex = html.hasAttribute('tabindex');
    const tabindex = html.getAttribute('tabindex');
    if (!hadTabindex) html.setAttribute('tabindex', '-1');
    html.focus({ preventScroll: true });
    const reached = html.ownerDocument.activeElement === html;
    if (!hadTabindex) html.removeAttribute('tabindex');
    else if (tabindex !== null) html.setAttribute('tabindex', tabindex);
    if (reached) before?.focus({ preventScroll: true });
    return !reached;
  });
}

/**
 * Whether the page is scroll-locked: a real wheel scroll over the middle of
 * the viewport does not move it. The scroll position is restored after.
 */
export async function isScrollLocked(page: Page): Promise<boolean> {
  const start = await page.evaluate(() => window.scrollY);
  const size = page.viewportSize() ?? { width: 800, height: 600 };
  await page.mouse.move(size.width / 2, size.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.scrollY);
  await page.evaluate((y) => window.scrollTo(0, y), start);
  return after === start;
}

/** A pointer press and release on the frame's outside area, at its visible pixels. */
export async function pointerOutside(page: Page): Promise<void> {
  const box = await page.locator('[data-behavior="outside"]').boundingBox();
  if (!box) throw new Error('The scenario frame has no outside area');
  await page.mouse.click(box.x + 8, box.y + 8);
}

/** The events the scenario reported with `behaviorEvent`, in order. */
export function behaviorEvents(page: Page): Promise<BehaviorEvent[]> {
  return page.evaluate(() => window.__behaviorEvents ?? []);
}

/** The frame's controls before and after the primitive. */
export const frame = {
  before: (page: Page) => page.locator('[data-behavior="before"]'),
  after: (page: Page) => page.locator('[data-behavior="after"]'),
  outside: (page: Page) => page.locator('[data-behavior="outside"]'),
};

/**
 * Open-to-focus time, measured inside the page: from the trigger's click to
 * the first `focusin` inside the opened layer. `close` runs between samples.
 */
export async function openToFocus(options: {
  trigger: Locator;
  /** A selector for the layer focus must land in, e.g. `[role="dialog"]`. */
  within: string;
  close: () => Promise<void>;
  samples?: number;
}): Promise<number[]> {
  const samples: number[] = [];
  for (let index = 0; index < (options.samples ?? 7); index += 1) {
    const elapsed = await options.trigger.evaluate(
      (trigger, within) =>
        new Promise<number>((resolve, reject) => {
          const doc = trigger.ownerDocument;
          const timeout = setTimeout(
            () => reject(new Error(`focus never reached ${within}`)),
            3000
          );
          const onFocus = (event: FocusEvent) => {
            if (!(event.target as Element | null)?.closest(within)) return;
            doc.removeEventListener('focusin', onFocus, true);
            clearTimeout(timeout);
            resolve(performance.now() - start);
          };
          doc.addEventListener('focusin', onFocus, true);
          const start = performance.now();
          (trigger as HTMLElement).click();
        }),
      options.within
    );
    samples.push(elapsed);
    await options.close();
  }
  return samples;
}

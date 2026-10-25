/**
 * Helpers the scenarios share. Like the harness oracle, they observe only
 * roles, names, states, focus and events. `[data-behavior-layer]` marks the
 * layer a scenario opens (dialog, menu, list…), so timing and focus checks
 * find it without reading DOM shape.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { behaviorEvents, focusedElement, openToFocus } from '../harness/oracle.ts';

export const layer = (page: Page) => page.locator('[data-behavior-layer]');

/** The page is in a known state: no layer open. */
export async function layerClosed(page: Page): Promise<void> {
  await expect(layer(page)).toHaveCount(0);
}

/** Waits until focus is on the element with this role and name. */
export async function expectFocus(page: Page, role: string, name: string): Promise<void> {
  await expect.poll(() => focusedElement(page)).toEqual({ role, name });
}

/** Waits until the event log equals `events`. */
export async function expectEvents(
  page: Page,
  events: { name: string; detail?: unknown }[]
): Promise<void> {
  await expect.poll(() => behaviorEvents(page)).toEqual(events);
}

/** The names of the events logged so far. */
export async function eventNames(page: Page): Promise<string[]> {
  return (await behaviorEvents(page)).map((event) => event.name);
}

/** Submits the scenario's form with its submit button and returns the posted fields. */
export async function submitForm(page: Page, button: string): Promise<Record<string, unknown>> {
  await page.getByRole('button', { name: button }).click();
  await expect.poll(async () => (await eventNames(page)).includes('submit')).toBe(true);
  const submit = (await behaviorEvents(page)).findLast((event) => event.name === 'submit');
  return (submit?.detail ?? {}) as Record<string, unknown>;
}

/** Open-to-focus samples: click `trigger`, wait for focus in the layer, close with Escape. */
export function sampleOpenToFocus(page: Page, trigger: Locator): Promise<number[]> {
  return openToFocus({
    trigger,
    within: '[data-behavior-layer]',
    close: async () => {
      await page.keyboard.press('Escape');
      await layerClosed(page);
    },
  });
}

/** Browsers where a click does not focus a button (so there is no opener to return focus to). */
export const CLICK_DOES_NOT_FOCUS = ['webkit'] as const;

/**
 * Opens a scenario with extra query parameters (for example a starting
 * `value`) and waits until it has mounted, like `gotoScenario`.
 */
export async function gotoScenarioWith(
  page: Page,
  primitive: string,
  params: Record<string, string>
): Promise<void> {
  const query = new URLSearchParams({ behavior: primitive, ...params });
  await page.goto(`/?${query.toString()}`);
  await expect(page.locator('html[data-behavior-ready="true"]')).toHaveCount(1);
}

import { expect, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /forms-page/ (PLAN_010 T-site-features), in the browser:
 *
 * 1. every field type paints as a labelled texuli control and its typed
 *    value shows live; a named format is checked live; the page passes axe
 *    in light and dark with every island hydrated;
 * 2. validation: an empty submit moves focus to the error summary, its links
 *    focus each answer, the async host validator refuses a taken handle, and
 *    a server refusal lands on its field;
 * 3. the multi-step flow shows a conditional field and runs its steps from
 *    the keyboard; drafts restore after a remount; the host data source
 *    fills the team choices; the player paints the agent form, sends its
 *    intent, and refuses the hostile one.
 *
 * Data, coverage and copy are unit-tested in apps/website/tests/site-forms.test.ts.
 */

const origin = serveDist();

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !url.startsWith('data:') && !url.startsWith('blob:'))
      foreign.push(url);
  });
  return foreign;
}

async function hydrated(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 20_000,
  });
}

async function open(page: Page): Promise<string[]> {
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/forms-page/`);
  await settle(page);
  return foreign;
}

test('every field type and format, live, axe-clean in light and dark', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const foreign = await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Forms as data, painted accessibly'
  );
  await expect(page.getByText('@texuli/forms · in development · on npm from 0.8.0')).toBeVisible();
  await expect(page.locator('[data-forms-types] tbody tr')).toHaveCount(15);

  await hydrated(page, '[data-forms-gallery]');
  const gallery = page.locator('[data-forms-gallery]');
  const form = gallery.getByRole('form', { name: 'Every field type' });
  await expect(form).toBeVisible();
  for (const label of [/Project title/, /Summary/, /Seats/, /Contact email/, /Website/]) {
    await expect(
      form.getByRole('textbox', { name: label }).or(form.getByRole('spinbutton', { name: label }))
    ).toBeVisible();
  }
  await expect(form.getByRole('combobox', { name: /Workspace/ })).toBeVisible();
  await expect(form.getByRole('group', { name: /Shared with/ })).toBeVisible();
  await expect(
    form.getByRole('group', { name: /Plan/ }).getByRole('radio', { name: 'Team' })
  ).toBeChecked();
  await expect(form.getByRole('checkbox', { name: 'Notify members' })).toBeVisible();
  await expect(form.getByRole('switch', { name: 'Public project' })).toBeVisible();
  await expect(form.getByRole('slider', { name: /Priority/ })).toBeVisible();
  await form.getByRole('spinbutton', { name: /Seats/ }).fill('12');
  await expect(page.locator('[data-forms-values]')).toContainText('"seats": 12');
  await form.getByRole('switch', { name: 'Public project' }).click();
  await expect(page.locator('[data-forms-values]')).toContainText('"public": false');

  await hydrated(page, '[data-forms-formats]');
  await page.getByRole('button', { name: 'Try 9410 as postal-code-us' }).click();
  await expect(page.locator('[data-forms-format-verdict]')).toHaveText(
    'Does not match postal-code-us'
  );
  await page.getByRole('button', { name: 'Try 94107-1234 as postal-code-us' }).click();
  await expect(page.locator('[data-forms-format-verdict]')).toHaveText('Matches postal-code-us');

  for (const selector of [
    '[data-forms-validation]',
    '[data-forms-flow]',
    '[data-forms-drafts]',
    '[data-forms-sources]',
    '[data-forms-agent]',
  ]) {
    await hydrated(page, selector);
  }
  await expect(page.locator('[data-forms-agent-stage]').getByRole('form')).toBeVisible({
    timeout: 20_000,
  });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  expect(await polishProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('validation: the error summary takes focus, links to answers, and host checks land on fields', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await open(page);
  await hydrated(page, '[data-forms-validation]');
  const section = page.locator('[data-forms-validation]');
  const form = section.getByRole('form', { name: 'Create a workspace' });
  await form.getByRole('button', { name: 'Create workspace' }).click();
  const summary = section.getByRole('heading', { name: 'There is a problem' });
  await expect(summary).toBeVisible();
  await expect(section.getByText(/answers need attention/)).toBeVisible();
  // A summary link focuses its answer.
  await section.getByRole('link', { name: /Every workspace needs an owner/ }).click();
  await expect(form.getByRole('textbox', { name: /Owner email/ })).toBeFocused();

  // The async host validator refuses a taken handle.
  const handle = form.getByRole('textbox', { name: /Workspace handle/ });
  const taken = form.locator('[data-tx-field-error]', {
    hasText: 'harbor is taken. Try another handle.',
  });
  await handle.fill('harbor');
  await page.keyboard.press('Tab');
  await expect(taken).toBeVisible();
  await handle.fill('quiet-harbor');
  await page.keyboard.press('Tab');
  await expect(taken).toHaveCount(0);

  // Fill the rest (the trial dates start filled in), let the server refuse, and see the error on its field.
  await form.getByRole('textbox', { name: /Owner email/ }).fill('ada@example.com');
  await form.getByRole('spinbutton', { name: /Seats/ }).fill('10');
  await section.getByRole('checkbox', { name: 'The server refuses the next submit' }).check();
  await form.getByRole('button', { name: 'Create workspace' }).click();
  await expect(
    form.locator('[data-tx-field-error]', { hasText: 'ada@example.com already owns a workspace.' })
  ).toBeVisible({
    timeout: 10_000,
  });
  await expect(section.locator('[data-forms-validation-outcome]')).toHaveText(
    'The server answered with field errors.'
  );
});

test('flow, drafts, data sources and the agent form', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);

  // The flow: a conditional field appears and becomes required; Next runs the steps.
  await hydrated(page, '[data-forms-flow]');
  const flow = page.locator('[data-forms-flow]');
  const flowForm = flow.getByRole('form', { name: 'Request a pilot workspace' });
  await expect(flowForm.getByRole('textbox', { name: /Your role/ })).toHaveCount(0);
  await flowForm.getByRole('radio', { name: 'Something else' }).check();
  await expect(flowForm.getByRole('textbox', { name: /Your role/ })).toBeVisible();
  await expect(
    flow.locator('[data-forms-logic-field="roleOther"] [data-cell="required"]')
  ).toHaveText('yes');
  await flowForm.getByRole('textbox', { name: /Full name/ }).fill('Ada Example');
  await flowForm.getByRole('textbox', { name: /Work email/ }).fill('ada@example.com');
  await flowForm.getByRole('textbox', { name: /Your role/ }).fill('Researcher');
  await flowForm.getByRole('button', { name: 'Next' }).click();
  await expect(flowForm.getByRole('heading', { name: 'Your team' })).toBeFocused();
  await flowForm.getByRole('spinbutton', { name: /People on the team/ }).fill('80');
  await expect(flow.locator('[data-forms-logic-step="review"]')).toHaveAttribute(
    'data-runs',
    'yes'
  );

  // Drafts: type, remount, restored.
  await hydrated(page, '[data-forms-drafts]');
  const drafts = page.locator('[data-forms-drafts]');
  const headline = drafts.getByRole('textbox', { name: /Headline/ });
  await headline.fill('Beta went out on time');
  await expect(drafts.locator('[data-forms-drafts-stored]')).toContainText(
    'Beta went out on time',
    {
      timeout: 5_000,
    }
  );
  await drafts.getByRole('button', { name: 'Remount the form' }).click();
  await expect(drafts.getByRole('textbox', { name: /Headline/ })).toHaveValue(
    'Beta went out on time'
  );
  await drafts.getByRole('button', { name: 'Restore a tampered draft' }).click();
  await expect(drafts.getByRole('textbox', { name: /Headline/ })).toHaveValue(
    'Restored from a tampered draft'
  );
  await drafts.getByRole('button', { name: 'Send feedback' }).click();
  await expect(drafts.getByRole('heading', { name: 'There is a problem' })).toBeVisible();

  // Data sources: the team choices come from the host source; the log shows the query.
  await hydrated(page, '[data-forms-sources]');
  const sources = page.locator('[data-forms-sources]');
  await expect(sources.locator('[data-forms-sources-log]')).toContainText('example.teams', {
    timeout: 10_000,
  });
  await expect(sources.getByRole('form', { name: 'Join a team' })).toBeVisible();
  const handle = sources.getByRole('textbox', { name: /Your handle/ });
  await handle.fill('lumen');
  await page.keyboard.press('Tab');
  await expect(sources.getByText('lumen is taken.')).toBeVisible({ timeout: 10_000 });

  await sources.getByRole('button', { name: 'Reload teams with a rate limit' }).click();
  await expect(sources.locator('[data-forms-sources-log]')).toContainText('rate-limited', {
    timeout: 10_000,
  });
  await expect(sources.getByRole('form', { name: 'Join a team' })).toBeVisible({ timeout: 10_000 });

  // The agent form: painted by the player; the hostile schema is refused.
  await hydrated(page, '[data-forms-agent]');
  const agent = page.locator('[data-forms-agent]');
  await expect(agent.getByRole('form', { name: 'Book an onboarding session' })).toBeVisible({
    timeout: 20_000,
  });
  await agent.getByRole('button', { name: 'Send the hostile form' }).click();
  await expect(agent.locator('[data-forms-agent-refused]')).toBeVisible({ timeout: 20_000 });
  await expect(agent.locator('[data-forms-agent-stage]').getByRole('form')).toHaveCount(0);
});

test('at 360 px nothing overflows', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  for (const selector of ['[data-forms-gallery]', '[data-forms-formats]', '[data-forms-flow]']) {
    await hydrated(page, selector);
  }
  expect(await polishProblems(page)).toEqual([]);
});

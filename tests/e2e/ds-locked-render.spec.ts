import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { Window } from 'happy-dom';
import { ALL_MANIFEST_GROUPS } from '../../packages/catalog/src/manifests/all.ts';
import { compileDesignSystem } from '../../packages/tokens/src/design-system/compile.ts';
import {
  checkLockedRenderTree,
  runLockedRenderChecks,
} from '../../packages/tools/src/ds-check/locked-render.ts';
import { DS_CHECK_AXE_TAGS } from '../../packages/tools/src/ds-check/render.ts';

const minimal = JSON.parse(
  readFileSync(
    new URL('../../packages/spec/fixtures/design-systems/minimal.json', import.meta.url),
    'utf8'
  )
) as unknown;
const allowed = {
  allow: Object.fromEntries(
    ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests).map((manifest) => [manifest.id, {}])
  ),
};

function mappedMarkup(markup: string) {
  const browser = new Window();
  try {
    browser.document.body.innerHTML = markup;
    const scope = browser.document.body;
    return checkLockedRenderTree(scope, allowed);
  } finally {
    browser.happyDOM.close();
  }
}

async function axe(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .include('[data-ds-check-scope]')
    .withTags(DS_CHECK_AXE_TAGS)
    .analyze();
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`);
}

test('locked render checks pass clean token-backed UI and catch runtime violations', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto('/ds-conformance.html');
  await expect(page.locator('#ds-status')).toHaveText(/^Ready: \d+ components$/u, {
    timeout: 60_000,
  });
  const result = compileDesignSystem(minimal);
  if (!result.ok)
    throw new Error(`The minimal design system must compile: ${JSON.stringify(result)}`);
  const run = {
    variant: null,
    ok: true,
    modes: result.modes,
    contrast: result.report.contrast,
    adjustments: result.report.adjustments,
    warnings: result.report.warnings,
    inlineBytes: result.report.inlineBytes,
    targets: result.report.targets,
    compiled: result,
  };

  const cleanMapping = mappedMarkup('<div data-tx-component="button"><button>Save</button></div>');
  const clean = await runLockedRenderChecks(page, [run], cleanMapping, {
    axe,
    modes: ['light'],
  });
  expect(clean.ok, JSON.stringify(clean.errors)).toBe(true);

  await page.locator('[data-ds-check-component="blocks-text"]').evaluate((root) => {
    const planted = document.createElement('p');
    planted.textContent = 'Off-token color sample';
    planted.style.color = '#123456';
    root.append(planted);
  });
  const offToken = await runLockedRenderChecks(page, [run], cleanMapping, {
    axe,
    modes: ['light'],
  });
  expect(offToken.ok).toBe(false);
  expect(offToken.codes).toContain('render-literal');

  await page.locator('[data-ds-check-scope]').evaluate((scope) => {
    const control = document.createElement('button');
    control.textContent = 'Unmapped action';
    scope.append(control);
  });
  const unmapped = await runLockedRenderChecks(
    page,
    [run],
    mappedMarkup('<button>Unmapped action</button>'),
    {
      axe,
      modes: ['light'],
    }
  );
  expect(unmapped.ok).toBe(false);
  expect(unmapped.codes).toContain('unmapped');

  await page.locator('[data-ds-check-scope]').evaluate((scope) => {
    const image = document.createElement('img');
    image.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    scope.append(image);
  });
  const inaccessible = await runLockedRenderChecks(page, [run], cleanMapping, {
    axe,
    modes: ['light'],
  });
  expect(inaccessible.ok).toBe(false);
  expect(inaccessible.codes).toContain('render-axe');
});

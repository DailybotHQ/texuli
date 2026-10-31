import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { ALL_MANIFEST_GROUPS } from '../../packages/catalog/src/manifests/all.ts';
import { protoyardThemeV1Fixture } from '../../packages/tokens/src/design-system/fixtures.ts';
import { importRolePalette } from '../../packages/tokens/src/design-system/import.ts';
import { getFullThemeLibraryMeta } from '../../packages/tokens/src/library-expand/index.ts';
import {
  checkDesignSystem,
  DS_CHECK_AXE_TAGS,
  DS_CHECK_KNOWN_FINDINGS,
  type DsCheckReport,
  type DsRenderRun,
  knownFinding,
  renderIssues,
  runDsRenderChecks,
} from '../../packages/tools/src/ds-check/index.ts';
import { settleAnimations } from './support/site.ts';

/*
 * T-ds-conformance: `texuli ds check --render` in CI. The fixture-app sheet
 * (tests/fixtures/app/ds-conformance.html) paints every agent-emittable
 * catalog component through the player inside one scope; each design system
 * is compiled by the static check and applied to that scope in every mode it
 * compiles (and its high-contrast variant when it has one). Each run must
 * pass axe (WCAG A and AA, scoped to the sheet), paint every contrast pair of
 * the compiled report at its ratio, and paint no color that ignores the
 * scope's variables. DS_CHECK_KNOWN_FINDINGS is empty (every finding of the
 * first run was fixed at its root); an entry added there must still be
 * found, so the list cannot rot.
 *
 * Brands: the spec fixtures acme (with variants) and minimal, and the
 * fictional protoyard-theme/v1 fixture imported as a role palette (harbor).
 * Library themes: six of the 210, spread across hue families (sorted by
 * seed hue, every 35th), rotated by TEXULI_DS_THEME_SEED (default 0) so a
 * run can sample others without a date in the test.
 */

const SPEC_FIXTURES = new URL('../../packages/spec/fixtures/design-systems/', import.meta.url);
const readFixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(name, SPEC_FIXTURES), 'utf8'));

const COMPONENTS = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests)
  .filter((manifest) => manifest.agentEmittable === true && manifest.examples.length > 0)
  .map((manifest) => manifest.id)
  .sort();

function harbor(): unknown {
  const imported = importRolePalette(protoyardThemeV1Fixture());
  if (!imported.ok) throw new Error('the protoyard-theme/v1 fixture must import');
  return imported.document;
}

const BRANDS: readonly { name: string; doc: () => unknown; variants: (string | null)[] }[] = [
  { name: 'acme', doc: () => readFixture('acme.json'), variants: [null, 'high-contrast'] },
  { name: 'minimal', doc: () => readFixture('minimal.json'), variants: [null] },
  { name: 'protoyard-theme/v1 (harbor)', doc: harbor, variants: [null] },
];

function hue(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const SEED = Number(process.env.TEXULI_DS_THEME_SEED ?? 0);
if (!Number.isInteger(SEED) || SEED < 0) throw new Error('TEXULI_DS_THEME_SEED is an integer >= 0');
const LIBRARY = [...(await getFullThemeLibraryMeta())].sort(
  (a, b) => hue(a.seed) - hue(b.seed) || a.id.localeCompare(b.id)
);
const STEP = Math.floor(LIBRARY.length / 6);
const THEMES = Array.from(
  { length: 6 },
  (_, i) => LIBRARY[(i * STEP + SEED) % LIBRARY.length]?.id as string
);

const axe = async (page: Page): Promise<string[]> => {
  await settleAnimations(page);
  const result = await new AxeBuilder({ page })
    .include('[data-ds-check-scope]')
    .withTags(DS_CHECK_AXE_TAGS)
    .analyze();
  return result.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
  );
};

async function openSheet(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ds-conformance.html');
  await expect(page.locator('#ds-status')).toHaveText(/^Ready: \d+ components$/u, {
    timeout: 60_000,
  });
  // Every example is a valid draft: nothing paints as a refusal or a placeholder.
  expect(
    await page.evaluate(() => (globalThis as Record<string, unknown>).dsCheckDiagnostics)
  ).toEqual({});
  await expect(page.locator('[data-ds-check-scope] [data-tx-player-error]')).toHaveCount(0);
}

/** The static report must pass; then every run renders clean. */
async function conform(
  page: Page,
  doc: unknown,
  variants: readonly (string | null)[]
): Promise<{ report: DsCheckReport; runs: DsRenderRun[] }> {
  const report = await checkDesignSystem(doc);
  expect(report.errors, 'static checks').toEqual([]);
  expect(report.runs.map((run) => run.variant)).toEqual(variants);
  await openSheet(page);
  const runs = await runDsRenderChecks(page, report.runs, { axe });
  // Every compiled mode of every run, light and dark.
  expect(runs.map((run) => `${run.variant ?? 'base'} ${run.mode}`)).toEqual(
    variants.flatMap((variant) => [`${variant ?? 'base'} light`, `${variant ?? 'base'} dark`])
  );
  for (const run of runs) {
    const label = `${run.variant ?? 'base'} ${run.mode}`;
    expect(run.components, label).toEqual(COMPONENTS);
    expect(run.checked, label).toBeGreaterThan(1000);
    expect(run.pairs.length, label).toBeGreaterThan(40);
    expect(renderIssues(run), label).toEqual([]);
    if (DS_CHECK_KNOWN_FINDINGS.length === 0) expect(run.known, label).toEqual([]);
    expect(run.ok, label).toBe(true);
  }
  return { report, runs };
}

test.describe('design-system conformance (texuli ds check --render)', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'chromium only (the CLI uses chromium)'
  );

  for (const brand of BRANDS) {
    test(`example brand ${brand.name}: every catalog component in every mode`, async ({ page }) => {
      test.setTimeout(240_000);
      const { runs } = await conform(page, brand.doc(), brand.variants);
      if (brand.name === 'acme') {
        // Every known finding is still found (remove an entry once its fix lands).
        const matched = new Set(
          runs.flatMap((run) => run.known.map((found) => knownFinding(found)))
        );
        const stale = DS_CHECK_KNOWN_FINDINGS.filter((entry) => !matched.has(entry));
        expect(stale.map((entry) => `${entry.component} ${entry.element}`)).toEqual([]);
      }
    });
  }

  test(`library themes ${THEMES.join(', ')} (seed ${SEED}): every catalog component, light and dark`, async ({
    page,
  }) => {
    test.setTimeout(480_000);
    expect(new Set(THEMES).size).toBe(6);
    for (const id of THEMES) {
      await test.step(id, async () => {
        await conform(
          page,
          {
            format: 'texuli/design-system',
            formatVersion: 1,
            id: `library-${id}`,
            version: '1.0.0',
            name: id,
            extends: `texuli:${id}`,
          },
          [null]
        );
      });
    }
  });

  test('the checks catch a planted literal color and a broken contrast pair', async ({ page }) => {
    test.setTimeout(120_000);
    const report = await checkDesignSystem(readFixture('minimal.json'));
    await openSheet(page);
    await page.evaluate(() => {
      const section = document.querySelector('[data-ds-check-component="blocks-text"]');
      const planted = document.createElement('p');
      planted.className = 'planted';
      planted.textContent = 'A literal color';
      planted.style.setProperty('color', '#123456');
      section?.append(planted);
      // A visually hidden element (a form bridge, screen-reader text) paints no pixel.
      const hidden = document.createElement('input');
      hidden.className = 'planted-hidden';
      for (const [name, value] of [
        ['position', 'absolute'],
        ['inline-size', '1px'],
        ['block-size', '1px'],
        ['overflow', 'hidden'],
        ['clip-path', 'inset(50%)'],
        ['background-color', '#654321'],
        ['color', '#654321'],
      ])
        hidden.style.setProperty(name as string, value as string);
      hidden.tabIndex = -1;
      hidden.setAttribute('aria-hidden', 'true');
      section?.append(hidden);
    });
    const compiled = report.runs[0]?.compiled;
    if (!compiled) throw new Error('minimal must compile');
    // A tampered compiled map: the muted text is painted on itself.
    const light = { ...compiled.vars.light };
    light['--tx-muted-foreground'] = light['--tx-muted'] as string;
    const tampered = { ...compiled, modes: ['light' as const], vars: { light } };
    const [run] = await runDsRenderChecks(
      page,
      [{ ...report.runs[0], compiled: tampered } as never],
      {
        axe,
      }
    );
    expect(run?.ok).toBe(false);
    expect(run?.literals).toContainEqual({
      component: 'blocks-text',
      element: 'p.planted',
      property: 'color',
      value: 'rgb(18, 52, 86)',
    });
    expect(run?.literals.some((literal) => literal.element.includes('planted-hidden'))).toBe(false);
    const codes = renderIssues(run as DsRenderRun).map((issue) => `${issue.code} ${issue.path}`);
    expect(codes).toContain('render-literal $.render["blocks-text"]');
    expect(codes).toContain('render-contrast $.vars.light["--tx-muted-foreground"]');
    expect(run?.axe.some((line) => line.startsWith('color-contrast'))).toBe(true);
  });
});

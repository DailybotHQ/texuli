/**
 * Baseline scope and component (PLAN_019 T-scope, Texuli 0.17.4, owner-approved Protoyard
 * ask): one `ds check --locked --render` run can cover several prototypes, so the same
 * selector on the same route of two prototypes must not merge into one key.
 *
 * - `DsFindingKey` gains the optional `scope` (any host-chosen string, such as a prototype
 *   id) and `component` (a catalog id); `dsReportFingerprint` includes them when present.
 * - `compareDsReport`: a baseline entry without scope (or component) matches any value, like
 *   route since 0.17.3, so an older baseline still matches.
 * - Hosts set the scope with `--scope <id>` or the `scope` option of
 *   `renderLockedDesignSystemCheck`; render findings carry the mapper's component.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDs } from '../src/cli/ds.ts';
import { compareDsReport, dsReportFingerprint } from '../src/ds-check/baseline.ts';
import { parseDsCliArgs } from '../src/ds-check/cli.ts';
import type { DsFullReport } from '../src/ds-check/full.ts';
import { dsFindingScope, renderLockedDesignSystemCheck } from '../src/ds-check/locked-render.ts';
import type { DsCheckPage } from '../src/ds-check/render.ts';
import { checkDesignSystem } from '../src/ds-check/static.ts';
import { MINIMAL_DESIGN_SYSTEM } from '../src/ops/design-system.ts';

const SELECTOR = 'main>div:nth-of-type(2)';
const at = (extra: Record<string, unknown> = {}) => ({
  code: 'not-allowed',
  path: SELECTOR,
  route: '/billing',
  viewport: '1280x720',
  ...extra,
});
const report = (...findings: unknown[]) => ({ findings });

describe('scope and component in the baseline key', () => {
  it('keeps the same selector on the same route of two prototypes apart', () => {
    const harbor = at({ scope: 'harbor-billing' });
    const lumen = at({ scope: 'lumen-billing' });
    expect(dsReportFingerprint(report(harbor))).not.toBe(dsReportFingerprint(report(lumen)));
    // One run covering both prototypes: two keys, and a finding in the second is new.
    const compare = compareDsReport(report(harbor), report(harbor, lumen));
    expect(compare.ok).toBe(false);
    expect(compare.added).toEqual([
      {
        code: 'not-allowed',
        path: SELECTOR,
        route: '/billing',
        viewport: '1280x720',
        scope: 'lumen-billing',
      },
    ]);
    // Fixing one prototype is a removal, not a merge.
    expect(compareDsReport(report(harbor, lumen), report(lumen)).removed).toHaveLength(1);
  });

  it('keeps two components at the same selector apart', () => {
    const a = at({ component: 'dialog' });
    const b = at({ component: 'sheet' });
    expect(dsReportFingerprint(report(a))).not.toBe(dsReportFingerprint(report(b)));
    expect(compareDsReport(report(a), report(a, b)).added).toHaveLength(1);
  });

  it('keys a finding without scope or component exactly as 0.17.3 did', () => {
    const line = `not-allowed\t${SELECTOR}\troute=/billing\tviewport=1280x720`;
    const before = createHash('sha256').update(line).digest('hex');
    expect(dsReportFingerprint(report(at()))).toBe(before);
    expect(dsReportFingerprint(report(at({ scope: '' })))).toBe(before);
  });

  it('reads an older baseline: no scope (or component) matches any value', () => {
    // A baseline saved by 0.17.3 (or Protoyard's v1 run, which had no scope).
    const older = report(at(), { code: 'render-literal', path: '$.render["button"] button' });
    const now = report(
      at({ scope: 'harbor-billing', component: 'dialog' }),
      at({ scope: 'lumen-billing', component: 'dialog' }),
      { code: 'render-literal', path: '$.render["button"] button', scope: 'harbor-billing' }
    );
    const compare = compareDsReport(older, now);
    expect(compare.ok).toBe(true);
    expect(compare.added).toEqual([]);
    expect(compare.removed).toEqual([]);
    // Migration: save the scoped report as the new baseline; from then on scopes separate.
    const migrated = compareDsReport(now, report(at({ scope: 'tidal-billing' })));
    expect(migrated.added.map((key) => key.scope)).toEqual(['tidal-billing']);
    // A scope the baseline does record still separates.
    const recorded = compareDsReport(report(at({ scope: 'harbor-billing' })), now).added;
    expect(recorded.filter((key) => key.code === 'not-allowed').map((key) => key.scope)).toEqual([
      'lumen-billing',
    ]);
  });

  it('bounds the scope and refuses control characters', () => {
    expect(dsFindingScope('harbor-billing')).toBe('harbor-billing');
    expect(dsFindingScope('s'.repeat(2_000))).toHaveLength(512);
    expect(dsFindingScope('a\nb')).toBeUndefined();
    expect(dsFindingScope('')).toBeUndefined();
    expect(dsFindingScope(7)).toBeUndefined();
    expect(dsReportFingerprint(report(at({ scope: 'x'.repeat(10_000) })))).toBe(
      dsReportFingerprint(report(at({ scope: 'x'.repeat(512) })))
    );
  });
});

/** A stubbed browser whose prototype page maps one not-allowed dialog. */
function stubBrowser() {
  const page: DsCheckPage = {
    goto: async () => undefined,
    emulateMedia: async () => undefined,
    waitForFunction: async () => true,
    viewportSize: () => ({ width: 1280, height: 720 }),
    evaluate: (async (_fn: unknown, arg: unknown) => {
      if (!Array.isArray(arg)) return ['button'];
      if (arg.length === 2)
        return {
          ok: false,
          codes: ['not-allowed'],
          errors: [
            {
              code: 'not-allowed',
              path: SELECTOR,
              message: 'Component "dialog" is not in the allow manifest.',
              source: 'dialog',
            },
          ],
        };
      return { components: ['button'], checked: 1, pairs: [], literals: [] };
    }) as DsCheckPage['evaluate'],
  };
  return async (specifier: string) => {
    if (specifier === 'playwright')
      return {
        chromium: {
          launch: async () => ({
            newContext: async () => ({ newPage: async () => page }),
            close: async () => undefined,
          }),
        },
      };
    if (specifier === '@axe-core/playwright')
      return {
        default: class {
          include() {
            return this;
          }
          withTags() {
            return this;
          }
          async analyze() {
            return { violations: [] };
          }
        },
      };
    throw new Error(`not installed: ${specifier}`);
  };
}

let directory: string | undefined;
afterEach(async () => {
  process.exitCode = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

async function scopedRun(scope: string) {
  directory ??= await mkdtemp(join(tmpdir(), 'texuli-ds-scope-'));
  const document = join(directory, 'harborline.json');
  await writeFile(
    document,
    JSON.stringify({ ...MINIMAL_DESIGN_SYSTEM, id: 'harborline', allow: { button: {} } })
  );
  const stdout: string[] = [];
  await runDs(
    [
      'check',
      document,
      '--locked',
      '--report',
      '--render',
      '--url',
      'http://127.0.0.1:9/billing',
      '--scope',
      scope,
      '--json',
    ],
    {
      cwd: process.cwd(),
      load: stubBrowser(),
      stdout: { write: (chunk: string) => stdout.push(chunk) },
      stderr: { write: () => undefined },
    }
  );
  process.exitCode = undefined;
  return JSON.parse(stdout.join('')) as DsFullReport & { fingerprint: string };
}

describe('hosts set the scope: the option and the CLI flag', () => {
  it('renderLockedDesignSystemCheck labels every locked render finding with its scope', async () => {
    const checked = await checkDesignSystem(MINIMAL_DESIGN_SYSTEM, { modes: ['light'] });
    const { locked } = await renderLockedDesignSystemCheck(
      checked,
      { allow: { button: {} } },
      { url: 'http://127.0.0.1:9/billing', load: stubBrowser(), scope: 'harbor-billing' }
    );
    expect(locked.errors.length).toBeGreaterThan(0);
    for (const issue of locked.errors) {
      expect(issue.scope).toBe('harbor-billing');
      expect(issue.route).toBe('/billing');
    }
  });

  it('--scope sets the scope on every finding, and render findings carry their component', async () => {
    const harbor = await scopedRun('harbor-billing');
    const lumen = await scopedRun('lumen-billing');
    expect(harbor.findings.length).toBeGreaterThan(0);
    for (const finding of harbor.findings) expect(finding.scope).toBe('harbor-billing');
    const dialog = harbor.findings.find((finding) => finding.path === SELECTOR);
    expect(dialog).toMatchObject({ code: 'not-allowed', component: 'dialog', route: '/billing' });
    // Same selector, same route, two prototypes: two keys.
    expect(harbor.fingerprint).not.toBe(lumen.fingerprint);
    expect(compareDsReport(harbor, { findings: [...harbor.findings, ...lumen.findings] }).ok).toBe(
      false
    );
  });

  it('--scope needs --locked and a value without control characters', () => {
    expect(parseDsCliArgs(['check', 'a.json', '--locked', '--scope', 'p1']).scope).toBe('p1');
    expect(() => parseDsCliArgs(['check', 'a.json', '--scope', 'p1'])).toThrow(/needs --locked/);
    expect(() => parseDsCliArgs(['check', 'a.json', '--locked', '--scope', 'a\u0007b'])).toThrow(
      /control characters/
    );
  });
});

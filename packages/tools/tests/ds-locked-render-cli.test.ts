/**
 * `ds check --locked --render` and `ds validate --locked --render` run the locked render
 * check (`renderLockedDesignSystemCheck`): chart, map and canvas marks are exempt from the
 * per-pixel literal check, a page you serve (`--url`) is mapped against the allow set, and
 * every finding lands in the full validator's report. The browser is a stub (`io.load`), so
 * no chromium runs here; the e2e suite drives a real one.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDs } from '../src/cli/ds.ts';
import type { DsFullReport } from '../src/ds-check/full.ts';
import * as dsCheck from '../src/ds-check/index.ts';
import type { DsCheckPage } from '../src/ds-check/render.ts';
import { MINIMAL_DESIGN_SYSTEM } from '../src/ops/design-system.ts';

let directory: string | undefined;
afterEach(async () => {
  process.exitCode = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

const ALLOW = { button: {}, 'charts-bar': {} };

async function files() {
  directory ??= await mkdtemp(join(tmpdir(), 'texuli-ds-locked-render-'));
  const document = join(directory, 'harborline.json');
  await writeFile(
    document,
    JSON.stringify({ ...MINIMAL_DESIGN_SYSTEM, id: 'harborline', name: 'Harborline', allow: ALLOW })
  );
  const sheet = join(directory, 'sheet.html');
  await writeFile(sheet, '<!doctype html><title>Sheet</title>');
  return { document, sheet };
}

/** A stubbed browser: the page answers the host calls the render driver makes. */
function stubBrowser() {
  const mapped: unknown[] = [];
  const page: DsCheckPage = {
    goto: async () => undefined,
    emulateMedia: async () => undefined,
    waitForFunction: async () => true,
    evaluate: (async (_fn: unknown, arg: unknown) => {
      if (!Array.isArray(arg)) return ['button', 'charts-bar'];
      if (arg.length === 2) {
        // The host's map({ allow }) on a prototype page.
        mapped.push(arg[1]);
        return {
          ok: false,
          codes: ['not-allowed'],
          errors: [
            {
              code: 'not-allowed',
              path: '$.render["dialog"]',
              message: 'Component "dialog" is not in the allow manifest.',
            },
          ],
        };
      }
      return {
        components: ['button', 'charts-bar'],
        checked: 4,
        pairs: [],
        literals: [
          // A chart mark: data visualization, exempt in locked mode.
          { component: 'charts-bar', element: 'rect', property: 'fill', value: 'rgb(1, 2, 3)' },
          // Button chrome: not exempt.
          {
            component: 'button',
            element: 'button',
            property: 'background-color',
            value: 'rgb(4, 5, 6)',
          },
        ],
      };
    }) as DsCheckPage['evaluate'],
  };
  const load = async (specifier: string) => {
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
  return { load, mapped };
}

async function run(args: string[], load: (specifier: string) => Promise<unknown>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  await runDs(args, {
    cwd: process.cwd(),
    load,
    stdout: { write: (chunk: string) => stdout.push(chunk) },
    stderr: { write: (chunk: string) => stderr.push(chunk) },
  });
  const exitCode = process.exitCode ?? 0;
  process.exitCode = undefined;
  return { stdout: stdout.join(''), stderr: stderr.join(''), exitCode };
}

const renderCodes = (report: DsFullReport) =>
  report.findings
    .filter((finding) => finding.code.startsWith('render-') || finding.code === 'not-allowed')
    .map((finding) => [finding.code, finding.path]);

describe('locked render: the public API', () => {
  it('exports the locked render checks from @texuli/tools/ds-check', () => {
    expect(dsCheck.runLockedRenderChecks).toBeTypeOf('function');
    expect(dsCheck.checkLockedRenderTree).toBeTypeOf('function');
    expect(dsCheck.renderLockedDesignSystemCheck).toBeTypeOf('function');
    expect(dsCheck.mapLockedRenderPage).toBeTypeOf('function');
    expect(dsCheck.DS_LOCKED_RENDER_EXEMPT_IDS).toEqual(['canvas', 'data-map', 'charts-*']);
  });
});

describe('ds validate --locked --render', () => {
  it('maps a served prototype against allow and exempts chart marks, in the full report', async () => {
    const { document } = await files();
    const browser = stubBrowser();
    const { stdout, exitCode } = await run(
      [
        'validate',
        document,
        '--locked',
        '--render',
        '--url',
        'http://127.0.0.1:9/prototype.html',
        '--json',
      ],
      browser.load
    );
    expect(exitCode).toBe(1);
    const report = JSON.parse(stdout) as DsFullReport;
    expect(report.format).toBe('texuli/ds-validate');
    // The page was mapped with the document's own allow set.
    expect(browser.mapped).toEqual([ALLOW]);
    const found = renderCodes(report);
    expect(found).toContainEqual(['not-allowed', '$.render["dialog"]']);
    expect(found).toContainEqual(['render-literal', '$.render["button"] button']);
    // The chart mark is exempt: no literal finding names charts-bar.
    expect(found.some(([, path]) => (path ?? '').includes('charts-bar'))).toBe(false);
    expect(report.codes).toEqual(expect.arrayContaining(['not-allowed', 'render-literal']));
    expect(report.check.render?.url).toBe('http://127.0.0.1:9/prototype.html');
    for (const run of report.check.render?.runs ?? [])
      expect(run.literals.map((literal) => literal.component)).toEqual(['button']);
    // Static findings are not counted twice.
    expect(report.summary.errors).toBe(
      report.findings.filter((finding) => finding.severity === 'error').length
    );
  });

  it('--report keeps the locked render findings and exits 0', async () => {
    const { document } = await files();
    const { stdout, exitCode } = await run(
      [
        'validate',
        document,
        '--locked',
        '--render',
        '--url',
        'http://127.0.0.1:9/p.html',
        '--report',
        '--json',
      ],
      stubBrowser().load
    );
    expect(exitCode).toBe(0);
    expect(renderCodes(JSON.parse(stdout) as DsFullReport)).toContainEqual([
      'not-allowed',
      '$.render["dialog"]',
    ]);
  });
});

describe('ds check --locked --render', () => {
  it('on a conformance sheet runs the locked checks without mapping the sheet', async () => {
    const { document, sheet } = await files();
    const browser = stubBrowser();
    const { stdout, exitCode } = await run(
      ['check', document, '--locked', '--render', '--sheet', sheet, '--json'],
      browser.load
    );
    expect(exitCode).toBe(1);
    // The sheet paints every catalog component by design; only a served page is mapped.
    expect(browser.mapped).toEqual([]);
    const found = renderCodes(JSON.parse(stdout) as DsFullReport);
    expect(found).toContainEqual(['render-literal', '$.render["button"] button']);
    expect(found.some(([, path]) => (path ?? '').includes('charts-bar'))).toBe(false);
    expect(found.some(([code]) => code === 'not-allowed')).toBe(false);
  });

  it('without --locked keeps the plain render check (chart marks are not exempt)', async () => {
    const { document, sheet } = await files();
    const browser = stubBrowser();
    const { stdout } = await run(
      ['check', document, '--render', '--sheet', sheet, '--json'],
      browser.load
    );
    expect(browser.mapped).toEqual([]);
    const report = JSON.parse(stdout) as { errors: { code: string; path: string }[] };
    expect(report.errors.map((error) => [error.code, error.path])).toContainEqual([
      'render-literal',
      '$.render["charts-bar"] rect',
    ]);
  });
});

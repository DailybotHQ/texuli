// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_FIXTURES,
  formatVisualSummary,
  parseScreenshotName,
  screenshotName,
  summarizeVisualReport,
  visualTargets,
} from '../../tests/visual/visual-lib.ts';
import { parseVisualArgs, playwrightArgs, VISUAL_SPEC } from '../visual.ts';

/**
 * The visual suite's pure half (Task 4 of PLAN_001_texuli_master): example
 * discovery from untrusted page data, screenshot names, and how a Playwright
 * JSON report becomes the list of changed examples `pnpm visual` prints. The
 * report fixtures mirror real reports from this spec (ANSI colors included).
 */

const ESC = String.fromCharCode(27);
const ansi = (text: string) => `${ESC}[2m${text}${ESC}[22m`;

describe('visualTargets', () => {
  it('captures the built-in smoke fixture even with no examples; adds registered examples after the fixtures, sorted, at /?fixture=<id> in their host; drops reserved ids, repeats, unsafe ids and non-objects', () => {
    expect(visualTargets(undefined)).toEqual(BUILT_IN_FIXTURES);
    expect(visualTargets([])).toEqual(BUILT_IN_FIXTURES);
    // adds registered examples after the fixtures, sorted, at /?fixture=<id> in their host
    {
      const targets = visualTargets([
        { id: 'texuli-button-sizes', title: 'Button sizes' },
        { id: 'core-safe-href' },
      ]);
      expect(targets.map((target) => target.id)).toEqual([
        'smoke',
        'builder',
        'builder-draft',
        'core-safe-href',
        'texuli-button-sizes',
      ]);
      expect(targets[3]).toEqual({
        id: 'core-safe-href',
        title: 'core-safe-href',
        path: '/?fixture=core-safe-href',
        host: '[data-example-host="core-safe-href"]',
        kind: 'example',
      });
      expect(targets[4]?.title).toBe('Button sizes');
    }
    // drops reserved ids, repeats, unsafe ids and non-objects
    {
      const targets = visualTargets([
        { id: 'ok' },
        { id: 'ok', title: 'again' },
        { id: 'examples' },
        { id: 'smoke' },
        { id: 'builder' },
        { id: 'builder-draft' },
        { id: 'Has Space' },
        { id: '../escape' },
        { id: 'a--b' },
        { id: 'x"]' },
        { id: 'x'.repeat(81) },
        null,
        'card',
        42,
      ]);
      expect(targets.map((target) => target.id)).toEqual([
        'smoke',
        'builder',
        'builder-draft',
        'ok',
      ]);
    }
  });
});

describe('screenshot names', () => {
  it('round-trips an id and scheme through the baseline and attachment names', () => {
    expect(screenshotName({ id: 'button-sizes' }, 'dark')).toBe('button-sizes--dark.png');
    for (const name of [
      'button-sizes--dark.png',
      'button-sizes--dark',
      'button-sizes--dark-diff.png',
      'button-sizes--dark-actual.png',
    ]) {
      expect(parseScreenshotName(name), name).toEqual({ id: 'button-sizes', scheme: 'dark' });
    }
    expect(parseScreenshotName('error-context')).toBeNull();
    expect(parseScreenshotName('button--sepia.png')).toBeNull();
  });
});

/** One result in the shape of Playwright's JSON reporter. */
function report(
  tests: {
    project: string;
    status: string;
    attachments?: string[];
    errors?: string[];
    stdout?: string[];
  }[]
) {
  return {
    suites: [
      {
        title: 'visual.spec.ts',
        suites: [
          {
            title: 'light mode',
            specs: tests.map((test) => ({
              title: 'every example matches its light baseline',
              tests: [
                {
                  projectName: test.project,
                  results: [
                    {
                      status: test.status,
                      attachments: (test.attachments ?? []).map((name) => ({ name })),
                      errors: (test.errors ?? []).map((message) => ({ message })),
                      stdout: (test.stdout ?? []).map((text) => ({ text })),
                    },
                  ],
                },
              ],
            })),
          },
        ],
      },
    ],
  };
}

const DIFF_ERROR = `Error: smoke (light, chromium)\n\n${ansi('expect(')}page${ansi(').')}toHaveScreenshot${ansi('(')}expected${ansi(')')} failed\n\n  891 pixels (ratio 0.01 of all image pixels) are different.\n\n  Snapshot: smoke--light.png`;

describe('summarizeVisualReport', () => {
  it('lists every changed example from its -diff attachment; lists missing baselines from the failure message; reads written and regenerated baselines from stdout under --update-snapshots; reports other failures (an example that never rendered) as errors, and skips skipped tests; survives an empty or malformed report', () => {
    // lists every changed example from its -diff attachment
    {
      const summary = summarizeVisualReport(
        report([
          {
            project: 'chromium',
            status: 'failed',
            attachments: [
              'smoke--light-expected.png',
              'smoke--light-actual.png',
              'smoke--light-diff.png',
              'card--light-diff.png',
              'error-context',
              'trace',
            ],
            errors: [DIFF_ERROR, DIFF_ERROR.replaceAll('smoke', 'card')],
          },
          { project: 'mobile', status: 'passed' },
        ])
      );
      expect(summary).toEqual({
        changed: [
          { id: 'card', scheme: 'light', project: 'chromium' },
          { id: 'smoke', scheme: 'light', project: 'chromium' },
        ],
        missing: [],
        errors: [],
        passed: 1,
      });
    }
    // lists missing baselines from the failure message
    {
      const summary = summarizeVisualReport(
        report([
          {
            project: 'mobile',
            status: 'failed',
            attachments: ['card--light-actual.png'],
            errors: [
              "Error: A snapshot doesn't exist at /repo/tests/visual/visual.spec.ts-snapshots/card--light-mobile-darwin.png, writing actual.",
            ],
          },
        ])
      );
      expect(summary.missing).toEqual([{ id: 'card', scheme: 'light', project: 'mobile' }]);
      expect(summary.changed).toEqual([]);
    }
    // reads written and regenerated baselines from stdout under --update-snapshots
    {
      const summary = summarizeVisualReport(
        report([
          {
            project: 'chromium',
            status: 'passed',
            stdout: [
              '/repo/tests/visual/visual.spec.ts-snapshots/smoke--light-chromium-darwin.png is re-generated, writing actual.\n',
              "A snapshot doesn't exist at /repo/tests/visual/visual.spec.ts-snapshots/card--light-chromium-darwin.png, writing actual.\n",
            ],
          },
        ])
      );
      expect(summary).toEqual({
        changed: [{ id: 'smoke', scheme: 'light', project: 'chromium' }],
        missing: [{ id: 'card', scheme: 'light', project: 'chromium' }],
        errors: [],
        passed: 1,
      });
    }
    // reports other failures (an example that never rendered) as errors, and skips skipped tests
    {
      const summary = summarizeVisualReport(
        report([
          {
            project: 'chromium',
            status: 'failed',
            errors: [
              `Error: card renders\n\n${ansi('expect(')}locator${ansi(').')}toBeVisible() failed\n\nTimeout: 5000ms`,
            ],
          },
          { project: 'webkit', status: 'skipped' },
          { project: 'mobile', status: 'timedOut' },
        ])
      );
      expect(summary.errors).toEqual([
        {
          project: 'chromium',
          title: 'every example matches its light baseline',
          message: 'Error: card renders',
        },
        {
          project: 'mobile',
          title: 'every example matches its light baseline',
          message: 'status timedOut',
        },
      ]);
      expect(summary.passed).toBe(0);
    }
    for (const value of [null, {}, { suites: 'x' }, { suites: [{ specs: [{}] }] }]) {
      expect(summarizeVisualReport(value), JSON.stringify(value)).toEqual({
        changed: [],
        missing: [],
        errors: [],
        passed: 0,
      });
    }
  });
});

describe('formatVisualSummary', () => {
  const change = { id: 'smoke', scheme: 'dark' as const, project: 'mobile' };

  it('names each changed example and how to accept it; says what an update wrote, and when nothing changed', () => {
    // names each changed example and how to accept it
    {
      const text = formatVisualSummary({ changed: [change], missing: [], errors: [], passed: 3 });
      expect(text).toContain('Changed examples (1):\n  smoke (dark, mobile)');
      expect(text).toContain('pnpm visual:update');
    }
    // says what an update wrote, and when nothing changed
    {
      const updated = formatVisualSummary(
        { changed: [change], missing: [change], errors: [], passed: 4 },
        true
      );
      expect(updated).toContain('Updated baselines (1):');
      expect(updated).toContain('New baselines written (1):');
      expect(updated).toContain('Review the new PNGs before committing them.');
      expect(formatVisualSummary({ changed: [], missing: [], errors: [], passed: 4 })).toBe(
        'Visual suite: no changes (4 capture sets passed).'
      );
    }
  });
});

describe('the runner arguments', () => {
  it('runs the visual spec on both projects with a JSON report; updates, narrows to one project and filters by title; refuses unknown arguments, unknown projects and missing values', () => {
    expect(playwrightArgs(parseVisualArgs([]))).toEqual([
      'exec',
      'playwright',
      'test',
      VISUAL_SPEC,
      '--project',
      'chromium',
      '--project',
      'mobile',
      '--reporter=list,json',
    ]);
    expect(
      playwrightArgs(parseVisualArgs(['--update', '--project', 'mobile', '-g', 'dark']))
    ).toEqual([
      'exec',
      'playwright',
      'test',
      VISUAL_SPEC,
      '--project',
      'mobile',
      '--reporter=list,json',
      '--update-snapshots',
      '-g',
      'dark',
    ]);
    expect(() => parseVisualArgs(['--project', 'webkit'])).toThrow(/Unknown project "webkit"/);
    expect(() => parseVisualArgs(['--project'])).toThrow(/needs a value/);
    expect(() => parseVisualArgs(['-g', '--update'])).toThrow(/needs a value/);
    expect(() => parseVisualArgs(['--headed'])).toThrow(/Unknown argument "--headed"/);
  });
});

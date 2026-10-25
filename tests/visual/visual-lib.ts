/**
 * The visual suite's pure half: which examples to capture, where each one
 * renders, how a screenshot is named, and how a Playwright JSON report becomes
 * a list of changed examples. No browser and no file system here, so
 * `scripts/tests/visual.test.ts` covers it in Vitest.
 *
 * Examples come from the registry (`@texuli/examples`, through the fixture
 * app's `src/examples.ts`). The fixture app renders one at `/?fixture=<id>`
 * inside `[data-example-host="<id>"]`, with a "Loading example…" status until
 * its lazy module arrives, or an alert when it fails to load. The app's own
 * `smoke` page is captured too, as a canary.
 */

export type ColorScheme = 'light' | 'dark';

export const COLOR_SCHEMES: readonly ColorScheme[] = ['light', 'dark'];

/** Playwright projects the suite captures: desktop Chromium and the Pixel 7. WebKit is left out on purpose. */
export const VISUAL_PROJECTS: readonly string[] = ['chromium', 'mobile'];

export interface VisualTarget {
  id: string;
  title: string;
  /** The fixture app path that renders it. */
  path: string;
  /** The element that holds what is captured. */
  host: string;
  kind: 'example' | 'fixture';
}

/** The fixture app's own pages: the smoke canary and the builder island. */
export const BUILT_IN_FIXTURES: readonly VisualTarget[] = [
  {
    id: 'smoke',
    title: 'Smoke fixture',
    path: '/?fixture=smoke',
    host: 'main[data-fixture="smoke"]',
    kind: 'fixture',
  },
  // The website's blueprint builder island (Task 77), mounted by the fixture
  // app because the examples registry may not import website code.
  {
    id: 'builder',
    title: 'Blueprint builder, empty draft',
    path: '/?fixture=builder',
    host: 'main[data-fixture="builder"]',
    kind: 'fixture',
  },
  {
    id: 'builder-draft',
    title: 'Blueprint builder, fictional report draft with the inspector open',
    path: '/?fixture=builder-draft',
    host: 'main[data-fixture="builder-draft"]',
    kind: 'fixture',
  },
];

/** The built-in fixtures also captured at a narrow phone width (360 CSS px). */
export const NARROW_FIXTURE_IDS: readonly string[] = ['builder', 'builder-draft'];

/** Fixture ids the app reserves for its own pages. */
const RESERVED = new Set(['smoke', 'examples', 'builder', 'builder-draft']);

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The targets to capture: the built-in fixtures, then every registered example
 * (sorted by id). An entry that is not `{ id: <kebab-case slug>, title? }`, a
 * reserved id or a repeated id is dropped.
 */
export function visualTargets(examples: readonly unknown[] | undefined): VisualTarget[] {
  const targets: VisualTarget[] = [];
  const seen = new Set<string>(RESERVED);
  for (const entry of Array.isArray(examples) ? examples : []) {
    if (entry === null || typeof entry !== 'object') continue;
    const { id, title } = entry as { id?: unknown; title?: unknown };
    if (typeof id !== 'string' || id.length > 80 || !ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    targets.push({
      id,
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 120) : id,
      path: `/?fixture=${encodeURIComponent(id)}`,
      host: `[data-example-host="${id}"]`,
      kind: 'example',
    });
  }
  return [...BUILT_IN_FIXTURES, ...targets.sort((a, b) => a.id.localeCompare(b.id))];
}

/** The baseline file name of one capture (Playwright adds the project and platform). */
export function screenshotName(target: Pick<VisualTarget, 'id'>, scheme: ColorScheme): string {
  return `${target.id}--${scheme}.png`;
}

/** Reads `smoke--dark` back out of a screenshot or attachment name. */
export function parseScreenshotName(name: string): { id: string; scheme: ColorScheme } | null {
  const match =
    /^([a-z0-9][a-z0-9-]*?)--(light|dark)(?:-(?:expected|actual|diff|previous))?(?:\.png)?$/.exec(
      name
    );
  return match ? { id: match[1] as string, scheme: match[2] as ColorScheme } : null;
}

// ── report ─────────────────────────────────────────────────────────────────

export interface VisualChange {
  id: string;
  scheme: ColorScheme;
  project: string;
}

export interface VisualSummary {
  /** Captures that differ from their baseline. */
  changed: VisualChange[];
  /** Captures with no baseline yet (the first run, or a new example). */
  missing: VisualChange[];
  /** Tests that failed for another reason (an example that never rendered…). */
  errors: { project: string; title: string; message: string }[];
  /** Tests that passed (one per project and color scheme). */
  passed: number;
}

interface ReportAttachment {
  name?: string;
}
interface ReportResult {
  status?: string;
  attachments?: ReportAttachment[];
  errors?: { message?: string }[];
  stdout?: { text?: string }[];
}
interface ReportTest {
  projectName?: string;
  results?: ReportResult[];
}
interface ReportSpec {
  title?: string;
  tests?: ReportTest[];
}
interface ReportSuite {
  specs?: ReportSpec[];
  suites?: ReportSuite[];
}

function* specsOf(suites: readonly ReportSuite[] | undefined): Generator<ReportSpec> {
  for (const suite of suites ?? []) {
    yield* suite.specs ?? [];
    yield* specsOf(suite.suites);
  }
}

const strip = (text: string) =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing ANSI colors is the point.
  text.replace(/\u001b\[[0-9;]*m/g, '').trim();

/**
 * Summarizes a Playwright JSON report of the visual spec: a capture whose
 * comparison failed leaves a `<name>-diff.png` attachment (changed); a capture
 * with no baseline fails with "doesn't exist" naming it (missing).
 */
export function summarizeVisualReport(report: unknown): VisualSummary {
  const summary: VisualSummary = { changed: [], missing: [], errors: [], passed: 0 };
  const suites = (report as { suites?: ReportSuite[] } | null)?.suites;
  const key = (change: VisualChange) => `${change.project}:${change.id}:${change.scheme}`;
  const seen = new Set<string>();
  const add = (list: VisualChange[], change: VisualChange) => {
    if (seen.has(key(change))) return;
    seen.add(key(change));
    list.push(change);
  };
  for (const spec of specsOf(suites)) {
    for (const test of spec.tests ?? []) {
      const project = test.projectName ?? 'unknown';
      const result = test.results?.at(-1);
      if (!result) continue;
      // With --update-snapshots, written baselines are only reported on stdout.
      for (const line of result.stdout ?? []) {
        const text = strip(line.text ?? '');
        const regenerated = /([a-z0-9-]+--(?:light|dark))[^/\s]*\.png is re-generated/i.exec(text);
        const created =
          /snapshot doesn't exist at .*?([a-z0-9-]+--(?:light|dark))[^/\s]*\.png/i.exec(text);
        const parsed = parseScreenshotName((regenerated ?? created)?.[1] ?? '');
        if (parsed) add(regenerated ? summary.changed : summary.missing, { ...parsed, project });
      }
      if (result.status === 'passed') {
        summary.passed += 1;
        continue;
      }
      if (result.status === 'skipped') continue;
      let explained = false;
      for (const attachment of result.attachments ?? []) {
        if (!attachment.name?.endsWith('-diff.png')) continue;
        const parsed = parseScreenshotName(attachment.name);
        if (parsed) {
          add(summary.changed, { ...parsed, project });
          explained = true;
        }
      }
      for (const error of result.errors ?? []) {
        const message = strip(error.message ?? '');
        const missing =
          /snapshot doesn't exist at .*?([a-z0-9-]+--(?:light|dark))[^/\s]*\.png/i.exec(message);
        if (missing) {
          const parsed = parseScreenshotName(missing[1] as string);
          if (parsed) {
            add(summary.missing, { ...parsed, project });
            explained = true;
          }
        } else if (!/Screenshot comparison failed|toHaveScreenshot/.test(message)) {
          summary.errors.push({
            project,
            title: spec.title ?? '',
            message: message.split('\n')[0] ?? '',
          });
          explained = true;
        }
      }
      if (!explained) {
        summary.errors.push({
          project,
          title: spec.title ?? '',
          message: `status ${result.status}`,
        });
      }
    }
  }
  const order = (a: VisualChange, b: VisualChange) => key(a).localeCompare(key(b));
  summary.changed.sort(order);
  summary.missing.sort(order);
  return summary;
}

/** The human summary `pnpm visual` prints. */
export function formatVisualSummary(summary: VisualSummary, updated = false): string {
  const lines: string[] = [];
  const row = (change: VisualChange) => `  ${change.id} (${change.scheme}, ${change.project})`;
  if (summary.changed.length > 0) {
    lines.push(
      `${updated ? 'Updated baselines' : 'Changed examples'} (${summary.changed.length}):`,
      ...summary.changed.map(row)
    );
  }
  if (summary.missing.length > 0) {
    lines.push(
      `${updated ? 'New baselines written' : 'Missing baselines'} (${summary.missing.length}):`,
      ...summary.missing.map(row)
    );
  }
  if (summary.errors.length > 0) {
    lines.push(
      `Errors (${summary.errors.length}):`,
      ...summary.errors.map((error) => `  ${error.title} (${error.project}): ${error.message}`)
    );
  }
  const clean =
    summary.changed.length === 0 && summary.missing.length === 0 && summary.errors.length === 0;
  lines.push(
    clean
      ? `Visual suite: no changes (${summary.passed} capture sets passed).`
      : updated
        ? 'Baselines updated. Review the new PNGs before committing them.'
        : 'Review the diffs in test-results/, then run pnpm visual:update to accept intended changes.'
  );
  return lines.join('\n');
}

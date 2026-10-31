/// <reference types="node" />
/**
 * The render half of `texuli ds check --render` (T-ds-conformance). It
 * drives a page that hosts `@texuli/tools/ds-check/host` (every catalog
 * component inside one scope) through Playwright: for each compiled run
 * (the base document and its variants) and each mode, it applies the design
 * system, runs axe inside the scope, measures the contrast pairs from the
 * computed colors and looks for painted colors that do not follow the
 * scope's `--tx-*` variables.
 *
 * Playwright and `@axe-core/playwright` are loaded only here, at run time,
 * from the caller's install: `@texuli/tools` does not depend on either.
 * Without them {@link renderDesignSystemCheck} throws a
 * {@link DsCheckRequirementError} that names what to install.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile';
import { issueCodes } from './static.ts';
import {
  DS_CHECK_GLOBAL,
  type DsCheckIssue,
  type DsCheckMode,
  type DsCheckReport,
  type DsCheckRun,
  type DsInspectPair,
  type DsInspectResult,
  type DsKnownFinding,
  type DsRenderLiteral,
  type DsRenderReport,
  type DsRenderRun,
} from './types.ts';

/** The fixture-app page the repository serves the catalog sheet from. */
export const DS_CHECK_SHEET_PATH = 'ds-conformance.html';

const UNSTYLED_CONTROL =
  'A native control the player leaves unstyled, so it paints the user agent colors (ButtonFace, Field, ButtonText) whatever the theme. Styling it from the contract moves the pixels of the player visual baselines and waits for an owner visual review (T-ds-conformance report).';

/**
 * Library findings that are known and tracked (T-ds-conformance): each one
 * paints the same color under every design system, with its reason. They are
 * reported as `known` and do not fail a run unless `strict` is set; the
 * conformance spec fails when one is no longer found, so the list cannot rot.
 */
export const DS_CHECK_KNOWN_FINDINGS: readonly DsKnownFinding[] = Object.freeze([
  {
    component: '*',
    element: 'section.tx-player-layout',
    property: 'background-color',
    reason:
      'The player layout card, slide and tile read --tx-card, which is not a contract variable, so they paint the user agent Canvas color (packages/player/src/player.css). The contract role is --tx-surface; the rename moves the dark visual baselines of the player examples and waits for an owner visual review.',
  },
  {
    component: 'blocks-embed',
    element: '',
    property: '',
    reason:
      'The link preview reads --tx-color-border, --tx-color-surface, --tx-color-text and --tx-color-link, which no theme declares, so it paints its fallbacks (#9ca3af, Canvas, CanvasText, LinkText). Deferred by T-adopt-domain to a visual review (scripts/check-token-usage.ts allowlist, packages/blocks/src/embed/).',
  },
  {
    component: 'blocks-structure',
    element: 'a',
    property: '',
    reason:
      'The structure block reads --tx-color-border, --tx-color-surface and --tx-color-foreground, which no theme declares, so it paints Canvas and CanvasText (packages/blocks/src/structure/structure.css). The rename to --tx-border, --tx-surface and --tx-foreground moves visual baselines and waits for an owner visual review.',
  },
  {
    component: 'data-dashboard-widget',
    element: '',
    property: '',
    reason:
      'The dashboard widget reads --tx-card and --tx-card-foreground, which are not contract variables, so it paints Canvas and CanvasText (packages/data/src/dashboard/Dashboard.svelte). The rename to --tx-surface and --tx-surface-foreground moves the dashboard visual baselines and waits for an owner visual review.',
  },
  { component: 'control-toggle', element: 'span', property: 'color', reason: UNSTYLED_CONTROL },
  {
    component: 'control-filter',
    element: 'input',
    property: 'background',
    reason: UNSTYLED_CONTROL,
  },
  {
    component: 'control-slider',
    element: 'input',
    property: 'background',
    reason: UNSTYLED_CONTROL,
  },
  { component: 'form-field', element: 'input', property: '', reason: UNSTYLED_CONTROL },
  { component: 'schema-form', element: 'input', property: '', reason: UNSTYLED_CONTROL },
  { component: 'form-submit', element: 'button', property: '', reason: UNSTYLED_CONTROL },
  { component: 'flow-action', element: 'button', property: '', reason: UNSTYLED_CONTROL },
  { component: 'sortable-list', element: 'button', property: '', reason: UNSTYLED_CONTROL },
]);

/** The known finding a literal matches, if any. */
export function knownFinding(
  literal: DsRenderLiteral,
  known: readonly DsKnownFinding[] = DS_CHECK_KNOWN_FINDINGS
): DsKnownFinding | undefined {
  return known.find(
    (entry) =>
      (entry.component === '*' || entry.component === literal.component) &&
      literal.element.startsWith(entry.element) &&
      literal.property.startsWith(entry.property)
  );
}

/** A missing requirement of `--render` (Playwright, axe, or a sheet page). */
export class DsCheckRequirementError extends Error {
  override name = 'DsCheckRequirementError';
}

/** The part of a Playwright `Page` the driver uses. */
export interface DsCheckPage {
  goto(url: string, options?: { timeout?: number }): Promise<unknown>;
  emulateMedia(options: {
    colorScheme?: 'light' | 'dark';
    reducedMotion?: 'reduce' | 'no-preference';
  }): Promise<void>;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  waitForFunction<A>(
    fn: (arg: A) => unknown,
    arg: A,
    options?: { timeout?: number }
  ): Promise<unknown>;
}

/** Runs axe inside the scope; returns one line per violation. */
export type DsAxeRunner = (page: DsCheckPage) => Promise<string[]>;

export interface DsRenderOptions {
  modes?: readonly DsCheckMode[];
  /** axe inside the scope; without it the axe check is skipped (the CLI always passes one). */
  axe?: DsAxeRunner;
  /** How long to wait for the sheet to paint (default 60 s). */
  timeoutMs?: number;
  /** Known findings that do not fail a run (default {@link DS_CHECK_KNOWN_FINDINGS}). */
  known?: readonly DsKnownFinding[];
  /** Fail on known findings too. */
  strict?: boolean;
}

/** The fields `applyDesignSystem` reads: what crosses into the page. */
function applicable(compiled: CompiledDesignSystem) {
  return {
    id: compiled.id,
    ...(compiled.variant ? { variant: compiled.variant } : {}),
    vars: compiled.vars,
    attrs: compiled.attrs,
    fontFaces: compiled.fontFaces,
    defaults: compiled.defaults,
  };
}

const varPath = (mode: string, name: string) => `$.vars.${mode}[${JSON.stringify(name)}]`;

/** The render findings of one run as report issues (`render-axe`, `render-contrast`, `render-literal`). */
export function renderIssues(run: DsRenderRun): DsCheckIssue[] {
  const where = { mode: run.mode, ...(run.variant ? { variant: run.variant } : {}) };
  const issues: DsCheckIssue[] = [];
  if (run.components.length === 0)
    issues.push({
      code: 'render-empty',
      path: '$',
      message: 'The sheet painted no component.',
      ...where,
    });
  for (const line of run.axe)
    issues.push({ code: 'render-axe', path: '$', message: `axe: ${line}`, ...where });
  for (const pair of run.pairs)
    if (!pair.pass)
      issues.push({
        code: 'render-contrast',
        path: varPath(run.mode, pair.foreground),
        message: `${pair.foreground} on ${pair.background} paints ${pair.ratio}:1 in ${run.mode} (the compiler reported ${pair.reported}:1); ${pair.required}:1 is required.`,
        ...where,
      });
  for (const literal of run.literals)
    issues.push({
      code: 'render-literal',
      path: `$.render[${JSON.stringify(literal.component)}]`,
      message: `${literal.component}: ${literal.element} paints ${literal.property} ${literal.value}, which does not follow the design system's variables.`,
      ...where,
    });
  return issues;
}

/**
 * Run the render checks on a page that already shows the sheet (the e2e
 * suite and adopters' own tests call this with their Playwright page).
 */
export async function runDsRenderChecks(
  page: DsCheckPage,
  runs: readonly DsCheckRun[],
  options: DsRenderOptions = {}
): Promise<DsRenderRun[]> {
  const timeout = options.timeoutMs ?? 60_000;
  await page.waitForFunction((name) => name in globalThis, DS_CHECK_GLOBAL, { timeout });
  await page.evaluate(
    (name) =>
      (globalThis as unknown as Record<string, { ready(): Promise<string[]> }>)[name]?.ready(),
    DS_CHECK_GLOBAL
  );
  const out: DsRenderRun[] = [];
  for (const run of runs) {
    const compiled = run.compiled;
    if (!compiled) continue;
    for (const mode of compiled.modes) {
      if (options.modes && !options.modes.includes(mode)) continue;
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      const pairs: DsInspectPair[] = (compiled.report.contrast[mode] ?? []).map((pair) => ({
        foreground: pair.foreground,
        background: pair.background,
        kind: pair.kind,
        required: pair.required,
        ratio: pair.ratio,
      }));
      const result = await page.evaluate(
        async ([name, ds, m, p]) => {
          const host = (
            globalThis as unknown as Record<
              string,
              | {
                  apply(compiled: unknown, mode: unknown): Promise<void>;
                  inspect(input: unknown): Promise<unknown>;
                }
              | undefined
            >
          )[name];
          if (!host) throw new Error('The page has no ds-check host.');
          await host.apply(ds, m);
          return (await host.inspect({ pairs: p })) as DsInspectResult;
        },
        [DS_CHECK_GLOBAL, applicable(compiled), mode, pairs] as const
      );
      const axe = options.axe ? await options.axe(page) : [];
      const literals: DsRenderLiteral[] = [];
      const known: DsRenderRun['known'] = [];
      for (const literal of result.literals) {
        const match = options.strict ? undefined : knownFinding(literal, options.known);
        if (match) known.push({ ...literal, reason: match.reason });
        else literals.push(literal);
      }
      const ok =
        axe.length === 0 &&
        literals.length === 0 &&
        result.pairs.every((pair) => pair.pass) &&
        result.components.length > 0;
      out.push({ ...result, literals, known, variant: run.variant, mode, axe, ok });
    }
  }
  return out;
}

const importOptional = (specifier: string): Promise<unknown> => import(specifier);

interface ChromiumLike {
  launch(options?: { headless?: boolean }): Promise<{
    newContext(): Promise<{ newPage(): Promise<DsCheckPage> }>;
    close(): Promise<void>;
  }>;
}

async function loadChromium(): Promise<ChromiumLike> {
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      const mod = (await importOptional(name)) as { chromium?: ChromiumLike };
      if (mod.chromium) return mod.chromium;
    } catch {
      // try the next one
    }
  }
  throw new DsCheckRequirementError(
    'texuli ds check --render needs Playwright with chromium: install "@playwright/test" (or "playwright") as a dev dependency, then run "npx playwright install chromium". The static checks run without it.'
  );
}

type AxeBuilderClass = new (options: {
  page: unknown;
}) => {
  include(selector: string): unknown;
  withTags(tags: string[]): unknown;
  analyze(): Promise<{
    violations: { id: string; impact?: string | null; nodes: { target: unknown[] }[] }[];
  }>;
};

/** The WCAG A and AA tags of the a11y sweeps (tests/e2e/support/site.ts adds best-practice). */
export const DS_CHECK_AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
];

/** An axe runner over `@axe-core/playwright`, scoped to the sheet. */
export async function playwrightAxeRunner(): Promise<DsAxeRunner> {
  let Builder: AxeBuilderClass | undefined;
  try {
    const mod = (await importOptional('@axe-core/playwright')) as {
      default?: AxeBuilderClass;
      AxeBuilder?: AxeBuilderClass;
    };
    Builder = mod.default ?? mod.AxeBuilder;
  } catch {
    Builder = undefined;
  }
  if (!Builder)
    throw new DsCheckRequirementError(
      'texuli ds check --render needs "@axe-core/playwright" for the axe check: install it as a dev dependency next to Playwright.'
    );
  const AxeBuilder = Builder;
  return async (page) => {
    const builder = new AxeBuilder({ page }) as {
      include(selector: string): typeof builder;
      withTags(tags: string[]): typeof builder;
      analyze(): Promise<{
        violations: { id: string; impact?: string | null; nodes: { target: unknown[] }[] }[];
      }>;
    };
    const result = await builder
      .include('[data-ds-check-scope]')
      .withTags(DS_CHECK_AXE_TAGS)
      .analyze();
    return result.violations.map(
      (v) =>
        `${v.id} (${v.impact ?? 'unknown'}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
    );
  };
}

/** The repository's fixture app above `from`, when there is one. */
export function findSheetApp(from: string): string | undefined {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const app = join(dir, 'tests', 'fixtures', 'app');
    if (existsSync(join(app, DS_CHECK_SHEET_PATH)) && existsSync(join(app, 'vite.config.ts')))
      return app;
    if (dirname(dir) === dir) return undefined;
  }
}

interface ViteLike {
  createServer(config: Record<string, unknown>): Promise<{
    listen(): Promise<unknown>;
    close(): Promise<void>;
    resolvedUrls?: { local: string[] } | null;
  }>;
}

async function startSheetServer(app: string) {
  let vite: ViteLike;
  try {
    const entry = createRequire(join(app, 'package.json')).resolve('vite');
    vite = (await importOptional(pathToFileURL(entry).href)) as ViteLike;
  } catch {
    throw new DsCheckRequirementError(
      'texuli ds check --render serves the repository sheet with Vite, which is not installed here. Pass --url <page> to check a page you serve.'
    );
  }
  const server = await vite.createServer({
    root: app,
    configFile: join(app, 'vite.config.ts'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await server.listen();
  const base = server.resolvedUrls?.local[0];
  if (!base) {
    await server.close();
    throw new DsCheckRequirementError('The sheet server did not report its URL.');
  }
  return { url: new URL(DS_CHECK_SHEET_PATH, base).href, close: () => server.close() };
}

export interface RenderDesignSystemCheckOptions extends DsRenderOptions {
  /** A page that hosts the ds-check host; default: the repository's fixture-app sheet. */
  url?: string;
  /** Where to look for the repository (default: the working directory). */
  cwd?: string;
}

/**
 * Add the render checks to a static report: launch headless chromium, open
 * the sheet (the repository's fixture app through Vite, or `url`), and run
 * {@link runDsRenderChecks} for every compiled run. Throws a
 * {@link DsCheckRequirementError} when Playwright, axe or a sheet is missing.
 */
export async function renderDesignSystemCheck(
  report: DsCheckReport,
  options: RenderDesignSystemCheckOptions = {}
): Promise<DsCheckReport> {
  const chromium = await loadChromium();
  const axe = options.axe ?? (await playwrightAxeRunner());
  let url = options.url;
  let stop: (() => Promise<void>) | undefined;
  if (url === undefined) {
    const app = findSheetApp(options.cwd ?? process.cwd());
    if (!app)
      throw new DsCheckRequirementError(
        `texuli ds check --render needs a sheet page: run it inside the Texuli repository (tests/fixtures/app/${DS_CHECK_SHEET_PATH}), or pass --url <page> that installs @texuli/tools/ds-check/host.`
      );
    const server = await startSheetServer(app);
    url = server.url;
    stop = server.close;
  }
  const browser = await chromium.launch({ headless: true });
  try {
    // axe needs a page of an explicit context.
    const page = await (await browser.newContext()).newPage();
    await page.goto(url, { timeout: options.timeoutMs ?? 60_000 });
    const runs = await runDsRenderChecks(page, report.runs, { ...options, axe });
    const render: DsRenderReport = { ok: runs.every((run) => run.ok), url, runs };
    const errors = [...report.errors, ...runs.flatMap(renderIssues)];
    return {
      ...report,
      ok: report.ok && render.ok,
      codes: issueCodes(errors),
      errors,
      render,
    };
  } finally {
    await browser.close();
    await stop?.();
  }
}

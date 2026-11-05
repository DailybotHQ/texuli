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
 * from the project that runs the check: `@texuli/tools` does not depend on
 * either. Without them {@link renderDesignSystemCheck} throws a
 * {@link DsCheckRequirementError} that names the exact packages to install.
 *
 * The sheet ships inside the published package (`dist/ds-check/sheet/`, a
 * built page with every component bundled) and is served from there by a
 * read-only static server, so a consumer needs no bundler and no Texuli
 * repository; `--sheet <page.html>` serves a page you built instead, and
 * `--url` checks a page you serve yourself.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  type CompiledDesignSystem,
  evaluateDesignSystemIndicators,
} from '@texuli/tokens/design-system/compile';
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

/** The sheet page: the built-in sheet's file name, and the fixture-app page of the repository. */
export const DS_CHECK_SHEET_PATH = 'ds-conformance.html';

/**
 * Library findings that are known and tracked: each one paints the same
 * color under every design system, with its reason. Empty: T-ds-conformance
 * fixed every finding its first run reported (player cards and controls,
 * the blocks link preview and structure block, the dashboard widget) at its
 * root, and `scripts/check-token-usage.ts` now refuses the causes (system
 * colors outside forced-colors, `--tx-*` names nothing defines). Known
 * findings are reported as `known` and do not fail a run unless `strict` is
 * set; adopters pass their own with the `known` option (`--known <file>`).
 * The conformance spec fails when an entry here is no longer found, so the
 * list cannot rot.
 */
export const DS_CHECK_KNOWN_FINDINGS: readonly DsKnownFinding[] = Object.freeze([]);

/**
 * Validate a known-findings list (what `--known <file>` reads): an array of
 * `{ component, element, property, reason }` strings, at most 500 entries.
 * Throws a `TypeError` naming the first bad entry.
 */
export function parseKnownFindings(value: unknown): DsKnownFinding[] {
  if (!Array.isArray(value)) throw new TypeError('Known findings are a JSON array.');
  if (value.length > 500) throw new RangeError('Known findings hold at most 500 entries.');
  return value.map((entry: unknown, index) => {
    const record = entry as Record<string, unknown> | null;
    const keys = ['component', 'element', 'property', 'reason'] as const;
    if (
      typeof record !== 'object' ||
      record === null ||
      Array.isArray(record) ||
      Object.keys(record).some((key) => !(keys as readonly string[]).includes(key)) ||
      keys.some((key) => typeof record[key] !== 'string') ||
      (record.component as string).length === 0 ||
      (record.reason as string).trim().length === 0
    )
      throw new TypeError(
        `Known finding ${index} needs exactly component, element, property and reason (strings; component and reason not empty).`
      );
    return {
      component: record.component as string,
      element: record.element as string,
      property: record.property as string,
      reason: record.reason as string,
    };
  });
}

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

/** A missing requirement of `--render` (Playwright, axe, chromium, or a sheet page). */
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
      // Every reported pair, and the blocking non-text indicators (D-G-029).
      const vars = compiled.vars[mode] ?? {};
      const pairs: DsInspectPair[] = [
        ...(compiled.report.contrast[mode] ?? []),
        ...evaluateDesignSystemIndicators(vars).filter((pair) => pair.blocking),
      ].map((pair) => ({
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

// ── requirements: Playwright and axe, from the project that runs the check ──

/** The Playwright packages that provide chromium, in the order they are tried. */
export const DS_CHECK_PLAYWRIGHT_PACKAGES = ['playwright', '@playwright/test', 'playwright-core'];

/** The axe package the render check runs inside the sheet. */
export const DS_CHECK_AXE_PACKAGE = '@axe-core/playwright';

/** Loads one optional package by name; rejects when it is not installed. */
export type DsModuleLoader = (specifier: string) => Promise<unknown>;

/**
 * The default loader: the package as the project in `cwd` resolves it (so a
 * strict pnpm install, where `@texuli/tools` cannot see the project's dev
 * dependencies, still finds them), then as `@texuli/tools` itself does.
 */
export function projectModuleLoader(cwd: string = process.cwd()): DsModuleLoader {
  const fromProject = createRequire(join(resolve(cwd), 'package.json'));
  return async (specifier) => {
    try {
      return fromProject(specifier) as unknown;
    } catch {
      return (await import(specifier)) as unknown;
    }
  };
}

interface ChromiumLike {
  launch(options?: { headless?: boolean }): Promise<{
    newContext(): Promise<{ newPage(): Promise<DsCheckPage> }>;
    close(): Promise<void>;
  }>;
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

/** What `--render` loads from the project: chromium and the axe builder (absent when not asked for). */
export interface DsRenderModules {
  chromium: ChromiumLike;
  AxeBuilder?: AxeBuilderClass;
}

/** The message of a missing render requirement: the exact packages, and the command that installs them. */
export function missingRenderPackagesMessage(missing: readonly string[]): string {
  const one = missing.length === 1;
  const list = missing.map((name) => `"${name}"`).join(' and ');
  const alternative = missing.includes('playwright')
    ? '; "@playwright/test" also works in place of "playwright"'
    : '';
  return `texuli ds check --render needs ${list}, which ${one ? 'is' : 'are'} not installed in this project. Install ${one ? 'it as a dev dependency' : 'them as dev dependencies'} (npm install --save-dev ${missing.join(' ')}${alternative}), then run "npx playwright install chromium". @texuli/tools does not depend on ${one ? 'it' : 'them'}, and the static checks run without ${one ? 'it' : 'them'}.`;
}

/**
 * Load Playwright's chromium and (unless `axe: false`, when the caller runs
 * its own axe) `@axe-core/playwright` from the project. Throws one
 * {@link DsCheckRequirementError} that names every missing package.
 */
export async function loadRenderModules(
  load: DsModuleLoader = projectModuleLoader(),
  options: { axe?: boolean } = {}
): Promise<DsRenderModules> {
  const needAxe = options.axe ?? true;
  let chromium: ChromiumLike | undefined;
  for (const name of DS_CHECK_PLAYWRIGHT_PACKAGES) {
    try {
      const mod = (await load(name)) as { chromium?: ChromiumLike } | undefined;
      chromium = mod?.chromium;
    } catch {
      chromium = undefined;
    }
    if (chromium) break;
  }
  let AxeBuilder: AxeBuilderClass | undefined;
  if (needAxe)
    try {
      const mod = (await load(DS_CHECK_AXE_PACKAGE)) as {
        default?: AxeBuilderClass;
        AxeBuilder?: AxeBuilderClass;
      };
      AxeBuilder = mod?.AxeBuilder ?? mod?.default;
    } catch {
      AxeBuilder = undefined;
    }
  const missing = [
    ...(chromium ? [] : ['playwright']),
    ...(!needAxe || typeof AxeBuilder === 'function' ? [] : [DS_CHECK_AXE_PACKAGE]),
  ];
  if (missing.length > 0 || !chromium)
    throw new DsCheckRequirementError(missingRenderPackagesMessage(missing));
  return AxeBuilder ? { chromium, AxeBuilder } : { chromium };
}

/** The WCAG A and AA tags of the a11y sweeps (tests/e2e/support/site.ts adds best-practice). */
export const DS_CHECK_AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
];

function axeRunner(AxeBuilder: AxeBuilderClass): DsAxeRunner {
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

/** An axe runner over `@axe-core/playwright` (as the project in `cwd` resolves it), scoped to the sheet. */
export async function playwrightAxeRunner(cwd?: string): Promise<DsAxeRunner> {
  const load = projectModuleLoader(cwd);
  let Builder: AxeBuilderClass | undefined;
  try {
    const mod = (await load(DS_CHECK_AXE_PACKAGE)) as {
      default?: AxeBuilderClass;
      AxeBuilder?: AxeBuilderClass;
    };
    Builder = mod?.AxeBuilder ?? mod?.default;
  } catch {
    Builder = undefined;
  }
  if (typeof Builder !== 'function')
    throw new DsCheckRequirementError(missingRenderPackagesMessage([DS_CHECK_AXE_PACKAGE]));
  return axeRunner(Builder);
}

// ── the sheet ───────────────────────────────────────────────────────────

/** The `--sheet` value of the conformance sheet that ships inside `@texuli/tools`. */
export const DS_CHECK_BUILTIN_SHEET = 'builtin';

/**
 * Where the published package keeps its built conformance sheet: beside this
 * module, in `dist/ds-check/sheet/` (`pnpm verify:packages` builds it from
 * `tests/fixtures/app/ds-conformance.html`, every component bundled, so it
 * needs no bundler and no other Texuli package at run time). A source
 * checkout has no built sheet; there the repository's fixture app serves it.
 */
export function builtinSheetDir(): string {
  return fileURLToPath(new URL('./sheet/', import.meta.url));
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

/** How a sheet is served: a built page as static files, or the repository's fixture app through Vite. */
export type DsCheckSheetSource =
  | { kind: 'static'; dir: string; page: string; builtin: boolean }
  | { kind: 'repository'; app: string };

/**
 * Resolve `--sheet`: `builtin` (the default) is the sheet inside this
 * package, or, in a source checkout without one, the repository's fixture
 * app; any other value is a built HTML page (a file path, relative to
 * `cwd`) that installs `@texuli/tools/ds-check/host`, served with the files
 * of its folder. Throws a {@link DsCheckRequirementError} when there is none.
 */
export function resolveDsCheckSheet(
  sheet: string = DS_CHECK_BUILTIN_SHEET,
  options: { cwd?: string; builtinDir?: string } = {}
): DsCheckSheetSource {
  const cwd = options.cwd ?? process.cwd();
  if (sheet === DS_CHECK_BUILTIN_SHEET) {
    const dir = options.builtinDir ?? builtinSheetDir();
    if (existsSync(join(dir, DS_CHECK_SHEET_PATH)))
      return { kind: 'static', dir, page: DS_CHECK_SHEET_PATH, builtin: true };
    const app = findSheetApp(cwd);
    if (app) return { kind: 'repository', app };
    throw new DsCheckRequirementError(
      `texuli ds check --render could not find the built-in conformance sheet (${join(dir, DS_CHECK_SHEET_PATH)}): it ships in the published @texuli/tools package, so reinstall it, or pass --sheet <page.html> (a built page that installs @texuli/tools/ds-check/host) or --url <page>.`
    );
  }
  const file = resolve(cwd, sheet);
  if (!/\.html?$/iu.test(file) || !existsSync(file) || !statSync(file).isFile())
    throw new DsCheckRequirementError(
      `texuli ds check --sheet ${sheet}: not an HTML file. Pass "builtin" (the default) or a built page (.html) that installs @texuli/tools/ds-check/host.`
    );
  return { kind: 'static', dir: dirname(file), page: basename(file), builtin: false };
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
};

/**
 * Serve the files of `dir` on 127.0.0.1 (an ephemeral port), read-only:
 * GET and HEAD only, nothing outside `dir`, no directory listing.
 */
export async function serveSheetDirectory(
  dir: string,
  page: string = DS_CHECK_SHEET_PATH
): Promise<{ url: string; close(): Promise<void> }> {
  const root = resolve(dir);
  const server = createServer((request, response) => {
    const send = (status: number, body = '') => {
      response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(body);
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') return send(405);
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url ?? '/', 'http://127.0.0.1').pathname);
    } catch {
      return send(400);
    }
    const file = resolve(root, `.${path}`);
    if ((file !== root && !file.startsWith(`${root}${sep}`)) || path.includes('\0'))
      return send(404);
    let body: Buffer;
    try {
      if (!statSync(file).isFile()) return send(404);
      body = readFileSync(file);
    } catch {
      return send(404);
    }
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': body.byteLength,
      'cache-control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => done());
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/${page.split('/').map(encodeURIComponent).join('/')}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}

interface ViteLike {
  createServer(config: Record<string, unknown>): Promise<{
    listen(): Promise<unknown>;
    close(): Promise<void>;
    resolvedUrls?: { local: string[] } | null;
  }>;
}

async function startRepositorySheet(app: string) {
  let vite: ViteLike;
  try {
    const entry = createRequire(join(app, 'package.json')).resolve('vite');
    vite = (await import(pathToFileURL(entry).href)) as ViteLike;
  } catch {
    throw new DsCheckRequirementError(
      'texuli ds check --render serves the repository sheet with Vite, which is not installed here. Pass --sheet <page.html> or --url <page> to check a page you built.'
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

/** Start serving a resolved sheet; returns its URL and how to stop it. */
export async function startDsCheckSheet(
  source: DsCheckSheetSource
): Promise<{ url: string; close(): Promise<void> }> {
  return source.kind === 'static'
    ? serveSheetDirectory(source.dir, source.page)
    : startRepositorySheet(source.app);
}

export interface RenderDesignSystemCheckOptions extends DsRenderOptions {
  /** A page that already hosts the ds-check host (you serve it); overrides `sheet`. */
  url?: string;
  /**
   * The sheet to serve: `builtin` (default), the conformance sheet inside
   * `@texuli/tools`, or the path of a built HTML page that installs the host.
   */
  sheet?: string;
  /** The project that runs the check: where Playwright and axe resolve from and relative paths start (default: the working directory). */
  cwd?: string;
  /** How optional packages load (default {@link projectModuleLoader} of `cwd`). */
  load?: DsModuleLoader;
}

/**
 * Add the render checks to a static report: launch headless chromium, open
 * the sheet (the built-in conformance sheet by default, a page you built
 * with `sheet`, or `url`), and run {@link runDsRenderChecks} for every
 * compiled run. Throws a {@link DsCheckRequirementError} when Playwright,
 * axe, chromium or a sheet is missing.
 */
export async function renderDesignSystemCheck(
  report: DsCheckReport,
  options: RenderDesignSystemCheckOptions = {}
): Promise<DsCheckReport> {
  const cwd = options.cwd ?? process.cwd();
  const modules = await loadRenderModules(options.load ?? projectModuleLoader(cwd), {
    axe: options.axe === undefined,
  });
  const axe = options.axe ?? axeRunner(modules.AxeBuilder as AxeBuilderClass);
  const source =
    options.url === undefined ? resolveDsCheckSheet(options.sheet, { cwd }) : undefined;
  let browser: Awaited<ReturnType<ChromiumLike['launch']>>;
  try {
    browser = await modules.chromium.launch({ headless: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new DsCheckRequirementError(
      `texuli ds check --render could not launch chromium (${reason}). Run "npx playwright install chromium" in this project.`
    );
  }
  let server: { url: string; close(): Promise<void> } | undefined;
  try {
    server = source ? await startDsCheckSheet(source) : undefined;
    const url = options.url ?? (server?.url as string);
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
    await server?.close();
  }
}

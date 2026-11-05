// @vitest-environment node
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseRouterArgs, routerHelp } from '../src/cli/router.ts';
import {
  builtinSheetDir,
  checkDesignSystem,
  DS_CHECK_AXE_PACKAGE,
  DS_CHECK_BUILTIN_SHEET,
  DS_CHECK_KNOWN_FINDINGS,
  DS_CHECK_PLAYWRIGHT_PACKAGES,
  DS_CHECK_SHEET_PATH,
  type DsCheckPage,
  type DsCheckReport,
  DsCheckRequirementError,
  findSheetApp,
  knownFinding,
  loadRenderModules,
  parseDsCliArgs,
  parseKnownFindings,
  renderDesignSystemCheck,
  renderIssues,
  resolveDsCheckSheet,
  runDsCli,
  runDsRenderChecks,
  serveSheetDirectory,
} from '../src/ds-check/index.ts';

const FIXTURES = new URL('../../spec/fixtures/design-systems/', import.meta.url);
const read = async (name: string) =>
  JSON.parse(await readFile(new URL(name, FIXTURES), 'utf8')) as Record<string, unknown>;

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    },
  };
}

let dir: string | undefined;
async function scratch(): Promise<string> {
  dir ??= await realpath(await mkdtemp(join(tmpdir(), 'texuli-ds-check-')));
  return dir;
}
async function file(name: string, value: unknown): Promise<string> {
  const path = join(await scratch(), name);
  await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value));
  return path;
}
afterEach(async () => {
  process.exitCode = undefined;
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

const doc = (extra: Record<string, unknown> = {}) => ({
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'acme-check',
  version: '1.0.0',
  name: 'Acme check',
  color: { brand: { seed: '#4f46e5' } },
  ...extra,
});

/** Runs `texuli ds check <args>` through the router; returns the exit code and the parsed JSON. */
async function check(args: readonly string[]) {
  const { out, err, io } = capture();
  const parsed = parseRouterArgs(['ds', 'check', ...args]);
  expect(parsed).toMatchObject({ kind: 'legacy', command: 'ds' });
  const result = await runDsCli(['check', ...args], io);
  const code = process.exitCode ?? 0;
  process.exitCode = undefined;
  const text = out.join('');
  return {
    result,
    code,
    err: err.join(''),
    text,
    json: args.includes('--json') ? (JSON.parse(text) as DsCheckReport) : undefined,
  };
}

describe('texuli ds check (static)', () => {
  it('passes the acme and minimal fixtures with exit 0: every mode, the high-contrast variant, the contrast report', async () => {
    const acme = await check([await file('acme.json', await read('acme.json')), '--json']);
    expect(acme.code).toBe(0);
    const report = acme.json as DsCheckReport;
    expect(report).toMatchObject({
      format: 'texuli/ds-check',
      version: 1,
      ok: true,
      codes: [],
      errors: [],
      document: { id: 'acme', version: '2.1.0', name: 'Acme' },
    });
    expect(report.runs.map((run) => [run.variant, run.ok, run.modes])).toEqual([
      [null, true, ['light', 'dark']],
      ['high-contrast', true, ['light', 'dark']],
    ]);
    for (const run of report.runs) {
      expect(run.hash).toMatch(/^[0-9a-f]{64}$/u);
      expect(run.contrast.light?.length).toBeGreaterThan(40);
      expect(run.contrast.dark?.every((pair) => pair.pass)).toBe(true);
      // The compiled maps stay out of the JSON.
      expect(run).not.toHaveProperty('compiled');
    }
    expect(report.runs[0]?.adjustments.length).toBeGreaterThan(0);

    const minimal = await check([await file('minimal.json', await read('minimal.json'))]);
    expect(minimal.code).toBe(0);
    expect(minimal.text).toMatch(
      /^PASS minimal@1\.0\.0\n {2}base light: (\d+)\/\1 contrast pairs pass/u
    );
    expect(minimal.text).not.toContain('high-contrast');
  });

  it('narrows with --mode and --variant, and refuses a variant the document does not declare', async () => {
    const path = await file('acme.json', await read('acme.json'));
    const dark = await check([path, '--json', '--mode', 'dark', '--variant', 'compact']);
    expect(dark.code).toBe(0);
    expect(dark.json?.runs.map((run) => [run.variant, run.modes])).toEqual([
      [null, ['dark']],
      ['compact', ['dark']],
    ]);
    const unknown = await check([path, '--json', '--variant', 'winter']);
    expect(unknown.code).toBe(1);
    expect(unknown.json?.errors).toEqual([
      expect.objectContaining({ code: 'invalid-value', path: '$.variants' }),
    ]);
  });

  it('follows extends to a library theme (texuli:<id>) and to --base files', async () => {
    const library = await check([
      await file('lib.json', doc({ extends: 'texuli:violet' })),
      '--json',
    ]);
    expect(library.code).toBe(0);
    const base = await file('base.json', doc({ id: 'base', version: '1.2.3' }));
    const child = await file('child.json', doc({ id: 'child', extends: 'base@1.2.3' }));
    expect((await check([child, '--base', base])).code).toBe(0);
    // Without the base the reference resolves to nothing: refused, exit 1.
    const missing = await check([child, '--json']);
    expect(missing.code).toBe(1);
    expect(missing.json?.errors[0]).toMatchObject({ code: 'invalid-value', path: '$.extends' });
  });

  it('sends every refusal code to exit 1 and to the JSON with its path', async () => {
    const invalid = new URL('invalid/', FIXTURES);
    const names = (await readdir(invalid)).filter((name) => name.endsWith('.json')).sort();
    const cases: { code: string; path: string; args: string[] }[] = [];
    for (const name of names) {
      const fixture = JSON.parse(await readFile(new URL(name, invalid), 'utf8')) as {
        expect: [string, string][];
        document: unknown;
        resolve?: Record<string, unknown>;
        trust?: string;
      };
      const args = [await file(name, fixture.document)];
      for (const [ref, base] of Object.entries(fixture.resolve ?? {}))
        args.push('--base', await file(`base-${ref}.json`, base));
      if (fixture.trust) args.push('--trust', fixture.trust);
      const [code, path] = fixture.expect[0] as [string, string];
      cases.push({ code, path, args });
    }
    // The guarantees, raised by the compiler.
    cases.push(
      {
        code: 'aa-text',
        path: '$.color.roles.light.foreground',
        args: [
          await file(
            'aa-text.json',
            doc({
              color: {
                brand: { seed: '#4f46e5' },
                roles: { light: { background: '#777777', foreground: '#888888' } },
              },
            })
          ),
        ],
      },
      {
        code: 'aa-focus',
        path: '$.accessibility.focusWidth',
        args: [await file('aa-focus.json', doc({ accessibility: { focusWidth: 1 } }))],
      },
      {
        code: 'target-size',
        path: '$.components.button["height-md"]',
        args: [
          await file('target.json', doc({ components: { button: { 'height-md': 'icon-sm' } } })),
        ],
      },
      // An invisible active sidebar item (D-G-029): the compiler only warns, the check refuses.
      {
        code: 'aa-non-text',
        path: '$.vars.light["--tx-sidebar-primary"]',
        args: [
          await file(
            'aa-non-text.json',
            doc({
              color: {
                brand: { seed: '#4f46e5' },
                roles: { light: { sidebar: '#4f46e5', sidebarPrimary: '#4f46e5' } },
              },
            })
          ),
        ],
      }
    );
    const seen = new Set<string>();
    for (const { code, path, args } of cases) {
      const run = await check([...args, '--json']);
      expect(run.code, code).toBe(1);
      expect(run.result.ok, code).toBe(false);
      expect(run.json?.ok, code).toBe(false);
      expect(run.json?.codes, code).toContain(code);
      expect(
        run.json?.errors.some((error) => error.code === code && error.path === path),
        `${code} at ${path}: ${JSON.stringify(run.json?.errors)}`
      ).toBe(true);
      // The human form names the code and the path too, with the same exit code.
      const human = await check(args);
      expect(human.code, code).toBe(1);
      expect(human.text, code).toContain(`${code} ${path}`);
      seen.add(code);
    }
    expect([...seen].sort()).toEqual(
      [
        'aa-focus',
        'aa-non-text',
        'aa-text',
        'extends-cycle',
        'extends-depth',
        'extends-range',
        'format-version',
        'inline-bytes',
        'invalid-type',
        'invalid-value',
        'required',
        'target-size',
        'unknown-key',
        'url-refused',
      ].sort()
    );
  }, 60_000);

  it('a variant that breaks a guarantee is refused with the variant named', async () => {
    const report = await checkDesignSystem(
      doc({ variants: { 'high-contrast': { accessibility: { focusWidth: 1 } } } })
    );
    expect(report.ok).toBe(false);
    expect(report.errors).toContainEqual(
      expect.objectContaining({ code: 'aa-focus', variant: 'high-contrast' })
    );
    expect(report.runs.map((run) => [run.variant, run.ok])).toEqual([
      [null, true],
      ['high-contrast', false],
    ]);
  });

  it('exits 2 when it cannot run: bad flags, no file, an unreadable or non-JSON file', async () => {
    const notJson = await file('broken.json', '{ nope');
    for (const [args, message] of [
      [[], /needs a file/u],
      [['a.json', 'b.json'], /one file/u],
      [['a.json', '--mode', 'dusk'], /--mode is/u],
      [['a.json', '--trust', 'root'], /--trust is/u],
      [['a.json', '--variant'], /needs a value/u],
      [['a.json', '--frob'], /Unknown ds check flag/u],
      [['a.json', '--url', 'http://127.0.0.1:1/'], /--url needs --render/u],
      [[join(await scratch(), 'missing.json')], /ENOENT|no such file/u],
      [[notJson], /not valid JSON/u],
    ] as const) {
      const { err, io } = capture();
      await runDsCli(['check', ...args], io);
      const run = { code: process.exitCode, err: err.join('') };
      process.exitCode = undefined;
      expect(run.code, args.join(' ')).toBe(2);
      expect(run.err, args.join(' ')).toMatch(message);
    }
    expect(parseRouterArgs(['ds', 'check', 'a.json', '--frob'])).toMatchObject({ kind: 'error' });
    expect(parseRouterArgs(['ds', 'lint'])).toMatchObject({ kind: 'error' });
    expect(parseDsCliArgs(['--help'])).toMatchObject({ help: true });
    expect(parseRouterArgs(['ds', '--help'])).toMatchObject({ kind: 'help', group: 'ds' });
    expect(parseRouterArgs(['ds', 'check', '--help'])).toMatchObject({
      kind: 'legacy',
      command: 'ds',
    });
    const { out, io } = capture();
    expect(await runDsCli(['--help'], io)).toEqual({ ok: true });
    expect(out.join('')).toContain('Usage: texuli ds check <file>');
    expect(routerHelp()).toContain('  ds check <file> ');
    for (const [args, message] of [
      [['a.json', '--strict'], /--strict needs --render/u],
      [['a.json', '--known', 'k.json'], /--known needs --render/u],
      [['a.json', '--render', '--known'], /needs a value/u],
    ] as const)
      expect(() => parseDsCliArgs(['check', ...args])).toThrow(message);
    expect(parseDsCliArgs(['check', 'a.json', '--render', '--known', 'k.json'])).toMatchObject({
      known: 'k.json',
      render: true,
    });
  });

  it('--sheet picks the sheet: builtin by default, a built page, never with --url', () => {
    expect(parseDsCliArgs(['check', 'a.json', '--render']).sheet).toBeUndefined();
    expect(
      parseDsCliArgs(['check', 'a.json', '--render', '--sheet', 'site/sheet.html'])
    ).toMatchObject({ sheet: 'site/sheet.html', render: true });
    expect(() => parseDsCliArgs(['check', 'a.json', '--sheet', 'builtin'])).toThrow(
      /--sheet needs --render/u
    );
    expect(() =>
      parseDsCliArgs(['check', 'a.json', '--render', '--sheet', 'x.html', '--url', 'http://a/'])
    ).toThrow(/exclusive/u);
  });

  it('the built-in sheet is the packaged one, served as static files; outside it a clear requirement', async () => {
    const root = await scratch();
    // A published install: dist/ds-check/sheet/ beside render.js.
    const packaged = join(root, 'dist', 'ds-check', 'sheet');
    await mkdir(join(packaged, 'assets'), { recursive: true });
    await writeFile(
      join(packaged, DS_CHECK_SHEET_PATH),
      '<!doctype html><script type="module" src="./assets/sheet.js"></script>'
    );
    await writeFile(join(packaged, 'assets', 'sheet.js'), 'globalThis.ok = 1;');
    await writeFile(join(root, 'secret.txt'), 'outside');
    // The packaged sheet wins over the repository's fixture app (cwd is the repository here).
    expect(resolveDsCheckSheet(DS_CHECK_BUILTIN_SHEET, { builtinDir: packaged })).toEqual({
      kind: 'static',
      dir: packaged,
      page: DS_CHECK_SHEET_PATH,
      builtin: true,
    });
    // A source checkout has no built sheet next to render.ts; the repository serves it instead.
    expect(builtinSheetDir()).toMatch(/src[/\\]ds-check[/\\]sheet[/\\]?$/u);
    expect(resolveDsCheckSheet(DS_CHECK_BUILTIN_SHEET, { builtinDir: join(root, 'none') })).toEqual(
      { kind: 'repository', app: findSheetApp(process.cwd()) }
    );
    // Neither: the requirement names the options.
    expect(() =>
      resolveDsCheckSheet(DS_CHECK_BUILTIN_SHEET, { builtinDir: join(root, 'none'), cwd: root })
    ).toThrow(/built-in conformance sheet.*--sheet <page\.html>.*--url <page>/su);
    // --sheet <page.html>: a built page, relative to cwd.
    expect(
      resolveDsCheckSheet(join('dist', 'ds-check', 'sheet', DS_CHECK_SHEET_PATH), { cwd: root })
    ).toMatchObject({ kind: 'static', dir: packaged, builtin: false });
    expect(() => resolveDsCheckSheet('secret.txt', { cwd: root })).toThrow(/not an HTML file/u);
    expect(() => resolveDsCheckSheet('nope.html', { cwd: root })).toThrow(DsCheckRequirementError);

    const server = await serveSheetDirectory(packaged);
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/ds-conformance\.html$/u);
      const page = await fetch(server.url);
      expect(page.status).toBe(200);
      expect(page.headers.get('content-type')).toMatch(/text\/html/u);
      const script = await fetch(new URL('./assets/sheet.js', server.url));
      expect([script.status, script.headers.get('content-type')]).toEqual([
        200,
        'text/javascript; charset=utf-8',
      ]);
      for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets', '/missing.js'])
        expect((await fetch(`${new URL(server.url).origin}${path}`)).status, path).toBe(404);
      expect((await fetch(server.url, { method: 'POST' })).status).toBe(405);
    } finally {
      await server.close();
    }
  });

  it('--render names the exact packages to install when Playwright or axe is missing (exit 2)', async () => {
    const missing = (names: readonly string[]) => async (name: string) => {
      if (names.includes(name)) throw new Error(`Cannot find module '${name}'`);
      return name === DS_CHECK_AXE_PACKAGE
        ? { default: class {} }
        : { chromium: { launch: async () => ({}) } };
    };
    const both = [...DS_CHECK_PLAYWRIGHT_PACKAGES, DS_CHECK_AXE_PACKAGE];
    await expect(loadRenderModules(missing(both))).rejects.toThrow(
      /needs "playwright" and "@axe-core\/playwright", which are not installed.*npm install --save-dev playwright @axe-core\/playwright.*npx playwright install chromium/su
    );
    await expect(loadRenderModules(missing([DS_CHECK_AXE_PACKAGE]))).rejects.toThrow(
      /needs "@axe-core\/playwright", which is not installed/u
    );
    await expect(loadRenderModules(missing(DS_CHECK_PLAYWRIGHT_PACKAGES))).rejects.toThrow(
      /needs "playwright", which is not installed/u
    );
    // A caller that runs its own axe needs Playwright only.
    await expect(
      loadRenderModules(missing([DS_CHECK_AXE_PACKAGE]), { axe: false })
    ).resolves.not.toHaveProperty('AxeBuilder');
    // @playwright/test alone is enough.
    await expect(loadRenderModules(missing(['playwright']))).resolves.toMatchObject({
      chromium: expect.any(Object),
    });

    const { err, io } = capture();
    const path = await file('minimal.json', await read('minimal.json'));
    const report = await checkDesignSystem(await read('minimal.json'));
    await expect(renderDesignSystemCheck(report, { load: missing(both) })).rejects.toThrow(
      DsCheckRequirementError
    );
    // The CLI resolves from the project (an empty folder here) before @texuli/tools itself.
    const outside = await scratch();
    const result = await runDsCli(['check', path, '--render', '--sheet', 'none.html'], {
      ...io,
      cwd: outside,
    });
    expect(result.ok).toBe(false);
    expect(process.exitCode).toBe(2);
    expect(err.join('')).toMatch(/not an HTML file|needs "playwright"/u);
  }, 30_000);
});

describe('known findings', () => {
  it('the library tracks none: every finding of the first conformance run was fixed', () => {
    expect(DS_CHECK_KNOWN_FINDINGS).toEqual([]);
  });

  it('parses an adopter list and refuses anything else, naming the entry', () => {
    const entry = { component: 'chart-bar', element: 'rect', property: 'fill', reason: 'r' };
    expect(parseKnownFindings([entry])).toEqual([entry]);
    expect(() => parseKnownFindings({})).toThrow(/JSON array/u);
    expect(() => parseKnownFindings(Array.from({ length: 501 }, () => entry))).toThrow(/500/u);
    for (const bad of [
      null,
      'chart-bar',
      { ...entry, extra: 1 },
      { ...entry, component: '' },
      { ...entry, reason: ' ' },
      { component: 'chart-bar', element: 'rect', reason: 'r' },
    ])
      expect(() => parseKnownFindings([entry, bad])).toThrow(/Known finding 1 /u);
  });

  it('a known finding does not fail a run unless strict, and a bad --known file cannot run', async () => {
    const report = await checkDesignSystem(await read('minimal.json'));
    const literal = { component: 'chart-bar', element: 'rect', property: 'fill', value: 'red' };
    const page: DsCheckPage = {
      goto: async () => undefined,
      emulateMedia: async () => undefined,
      waitForFunction: async () => true,
      evaluate: (async (_fn: unknown, arg: unknown) =>
        Array.isArray(arg)
          ? { components: ['chart-bar'], checked: 3, pairs: [], literals: [literal] }
          : ['chart-bar']) as DsCheckPage['evaluate'],
    };
    const known = [{ component: 'chart-bar', element: 'rect', property: '', reason: 'tracked' }];
    expect(knownFinding(literal, known)).toBe(known[0]);
    expect(knownFinding(literal)).toBeUndefined();
    const options = { modes: ['light' as const], axe: async () => [] };
    const [tracked] = await runDsRenderChecks(page, report.runs, { ...options, known });
    expect(tracked).toMatchObject({
      ok: true,
      literals: [],
      known: [{ ...literal, reason: 'tracked' }],
    });
    const [strict] = await runDsRenderChecks(page, report.runs, {
      ...options,
      known,
      strict: true,
    });
    expect(strict).toMatchObject({ ok: false, literals: [literal], known: [] });
    const [untracked] = await runDsRenderChecks(page, report.runs, options);
    expect(untracked?.ok).toBe(false);

    const path = await file('minimal.json', await read('minimal.json'));
    const bad = await file('known.json', JSON.stringify([{ component: 'x' }]));
    const { err, io } = capture();
    await runDsCli(['check', path, '--render', '--known', bad], io);
    const code = process.exitCode;
    process.exitCode = undefined;
    expect(code).toBe(2);
    expect(err.join('')).toMatch(/Known finding 0 /u);
  });
});

describe('render findings', () => {
  it('turns a page result into render-* codes, and a clean page into no issue', async () => {
    const report = await checkDesignSystem(await read('minimal.json'));
    const inspected = {
      components: ['blocks-text', 'chart-bar'],
      checked: 12,
      pairs: [
        {
          foreground: '--tx-foreground',
          background: '--tx-background',
          kind: 'text' as const,
          required: 4.5,
          ratio: 3.1,
          reported: 15.2,
          pass: false,
        },
      ],
      literals: [
        { component: 'chart-bar', element: 'rect', property: 'fill', value: 'rgb(0, 0, 0)' },
      ],
    };
    const calls: string[] = [];
    const sent: { foreground: string; background: string; required: number }[][] = [];
    const page: DsCheckPage = {
      goto: async () => undefined,
      emulateMedia: async (options) => {
        calls.push(`media ${options.colorScheme}`);
      },
      waitForFunction: async () => true,
      evaluate: (async (_fn: unknown, arg: unknown) => {
        if (!Array.isArray(arg)) return ['blocks-text'];
        sent.push(arg[3] as (typeof sent)[number]);
        return inspected;
      }) as DsCheckPage['evaluate'],
    };
    const runs = await runDsRenderChecks(page, report.runs, {
      axe: async () => ['color-contrast (serious): .x'],
    });
    expect(calls).toEqual(['media light', 'media dark']);
    // The painted pairs include the sidebar's active fill on the sidebar at 3:1 (D-G-029).
    for (const pairs of sent)
      expect(pairs).toContainEqual(
        expect.objectContaining({
          foreground: '--tx-sidebar-primary',
          background: '--tx-sidebar',
          required: 3,
        })
      );
    expect(runs.map((run) => [run.variant, run.mode, run.ok])).toEqual([
      [null, 'light', false],
      [null, 'dark', false],
    ]);
    const issues = renderIssues(runs[0] as (typeof runs)[number]);
    expect(issues.map((issue) => [issue.code, issue.path])).toEqual([
      ['render-axe', '$'],
      ['render-contrast', '$.vars.light["--tx-foreground"]'],
      ['render-literal', '$.render["chart-bar"]'],
    ]);
    expect(
      renderIssues({
        ...(runs[0] as (typeof runs)[number]),
        components: [],
        axe: [],
        pairs: [],
        literals: [],
      })
    ).toEqual([expect.objectContaining({ code: 'render-empty' })]);
    const clean = await runDsRenderChecks(page, report.runs, {
      modes: ['dark'],
      axe: async () => [],
    });
    expect(clean).toHaveLength(1);
    expect(clean[0]?.ok).toBe(false); // the inspected result above still has findings
  });
});

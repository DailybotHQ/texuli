// @vitest-environment node
/**
 * scripts/check-md-parity.ts (PLAN_011 T-ar-twins): every built HTML page
 * but the allowlist has a twin with a valid header block, linked from the
 * head and mapped in md-manifest.json. Fixtures are built in memory and in a
 * temporary directory; the real build is checked by the gate itself.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { twinHeader } from '../../apps/website/src/components/docs/twins.ts';
import {
  type BuiltPage,
  checkMdParity,
  linksTwin,
  readBuild,
  routeOf,
} from '../check-md-parity.ts';

const ORIGIN = 'https://texuli.com';

function html(twin: string | undefined): string {
  const link = twin ? `<link rel="alternate" type="text/markdown" href="${twin}">` : '';
  return `<!doctype html><html lang="en"><head><title>Page · Texuli</title>${link}</head><body><main><h1>Page</h1></main></body></html>`;
}

function twinText(route: string, twin: string, overrides: { canonical?: string } = {}): string {
  return `${twinHeader({
    title: 'Page',
    language: 'en',
    canonical: overrides.canonical ?? `${ORIGIN}${route}`,
    twinUrl: `${ORIGIN}${twin}`,
    origin: ORIGIN,
    lastUpdated: '2026-10-30',
  })}Body.\n`;
}

/** A healthy build: the home, a docs page, a non-docs page and the 404. */
function healthy() {
  const pages: BuiltPage[] = [
    { route: '/', html: html('/index.md') },
    { route: '/guides/theming/', html: html('/guides/theming.md') },
    { route: '/theme-studio/', html: html('/theme-studio.md') },
    { route: '/404.html', html: html(undefined) },
  ];
  const twins: Record<string, string> = {
    '/index.md': twinText('/', '/index.md'),
    '/guides/theming.md': twinText('/guides/theming/', '/guides/theming.md'),
    '/theme-studio.md': twinText('/theme-studio/', '/theme-studio.md'),
  };
  const manifest: Record<string, string> = {
    '/': '/index.md',
    '/guides/theming/': '/guides/theming.md',
    '/theme-studio/': '/theme-studio.md',
  };
  return { pages, twins, manifest };
}

function run(fixture: ReturnType<typeof healthy>) {
  return checkMdParity({
    pages: fixture.pages,
    manifest: fixture.manifest,
    origin: ORIGIN,
    readTwin: (path) => fixture.twins[path],
  });
}

describe('check-md-parity', () => {
  it('passes a healthy build and reports the exempt 404 with its reason', () => {
    const report = run(healthy());
    expect(report.problems).toEqual([]);
    expect(report.pages).toBe(4);
    expect(report.twins).toBe(3);
    expect(report.exempt).toEqual([{ route: '/404.html', reason: expect.stringMatching(/404/) }]);
  });

  it('fails a page without a twin, the home page included', () => {
    const fixture = healthy();
    delete fixture.twins['/index.md'];
    expect(run(fixture).problems).toContain('/: no twin at /index.md');
  });

  it('fails a twin without a valid header block', () => {
    const fixture = healthy();
    fixture.twins['/theme-studio.md'] =
      '# Theme studio\n\nSource: https://texuli.com/theme-studio/\n';
    const problems = run(fixture).problems;
    expect(problems).toContain('/theme-studio.md: has no "Language:" line');
    expect(problems).toContain('/theme-studio.md: has no "Last Updated:" line');
  });

  it('fails a wrong Canonical, a missing head link and a manifest gap', () => {
    const fixture = healthy();
    fixture.twins['/guides/theming.md'] = twinText('/guides/theming/', '/guides/theming.md', {
      canonical: `${ORIGIN}/guides/`,
    });
    fixture.pages[2] = { route: '/theme-studio/', html: html(undefined) };
    delete fixture.manifest['/'];
    const report = run(fixture);
    expect(report.problems).toEqual(
      expect.arrayContaining([
        `/guides/theming.md: Canonical is "${ORIGIN}/guides/", expected "${ORIGIN}/guides/theming/"`,
        '/theme-studio/: the head has no <link rel="alternate" type="text/markdown" href="/theme-studio.md">',
        '/: md-manifest.json does not map it to /index.md',
      ])
    );
    expect(report.twins).toBe(0);
  });

  it('fails a build without a manifest, and skips redirect stubs', () => {
    const fixture = healthy();
    const report = checkMdParity({
      pages: [
        ...fixture.pages,
        {
          route: '/old/',
          html: '<!doctype html><meta http-equiv="refresh" content="0;url=/guides/">',
        },
      ],
      manifest: undefined,
      origin: ORIGIN,
      readTwin: (path) => fixture.twins[path],
    });
    expect(report.problems).toContain('md-manifest.json is missing or has no twins map');
    expect(report.exempt.map((entry) => entry.route)).toEqual(['/404.html', '/old/']);
  });

  it('linksTwin reads the head only, in any attribute order', () => {
    expect(
      linksTwin('<head><link type="text/markdown" href="/a.md" rel="alternate"></head>', '/a.md')
    ).toBe(true);
    expect(
      linksTwin(
        '<head></head><body><link rel="alternate" type="text/markdown" href="/a.md"></body>',
        '/a.md'
      )
    ).toBe(false);
    expect(
      linksTwin('<head><link rel="alternate" type="text/html" href="/a.md"></head>', '/a.md')
    ).toBe(false);
  });
});

describe('check-md-parity on a directory', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('reads routes, twins and the manifest from disk', () => {
    dir = mkdtempSync(join(tmpdir(), 'md-parity-'));
    mkdirSync(join(dir, 'guides/theming'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), html('/index.md'));
    writeFileSync(join(dir, 'guides/theming/index.html'), html('/guides/theming.md'));
    writeFileSync(join(dir, '404.html'), html(undefined));
    writeFileSync(join(dir, 'index.md'), twinText('/', '/index.md'));
    writeFileSync(
      join(dir, 'guides/theming.md'),
      twinText('/guides/theming/', '/guides/theming.md')
    );
    writeFileSync(
      join(dir, 'md-manifest.json'),
      JSON.stringify({ twins: { '/': '/index.md', '/guides/theming/': '/guides/theming.md' } })
    );
    expect(routeOf(dir, join(dir, 'guides/theming/index.html'))).toBe('/guides/theming/');
    expect(routeOf(dir, join(dir, '404.html'))).toBe('/404.html');
    const report = checkMdParity(readBuild(dir, ORIGIN));
    expect(report).toMatchObject({ pages: 3, twins: 2, problems: [] });

    rmSync(join(dir, 'guides/theming.md'));
    expect(checkMdParity(readBuild(dir, ORIGIN)).problems).toEqual([
      '/guides/theming/: no twin at /guides/theming.md',
    ]);
  });
});

// @vitest-environment node
/**
 * The contracts of the landing, native and architecture sections
 * (src/components/sections). The copy itself is reviewed by people and the
 * rendered pages by the site-*.spec.ts e2e specs with axe; this file keeps
 * what can only drift silently:
 *
 * - every claim cites a repository file that still says it, and every code
 *   excerpt is a byte-for-byte slice of the file it names (honesty rule);
 * - the architecture layer data matches docs/ARCHITECTURE.md and the
 *   enforced guard in scripts/check-layers.ts, and points down only;
 * - every link a section renders is an on-site route that exists, and the
 *   templates never write a literal href or an HTML sink;
 * - no section promises what is not shipped.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAYERS as GUARD_LAYERS } from '../../../scripts/check-layers.ts';
import * as layers from '../src/components/sections/architecture/layers-data.ts';
import * as parity from '../src/components/sections/architecture/parity-data.ts';
import * as portability from '../src/components/sections/architecture/portability-content.ts';
import * as home from '../src/components/sections/home/home-content.ts';
import * as nativeEvidence from '../src/components/sections/native/native-evidence-data.ts';
import * as nativeHero from '../src/components/sections/native/native-hero-content.ts';
import * as nativeParity from '../src/components/sections/native/native-parity.ts';
import * as whyKmp from '../src/components/sections/native/why-kmp-content.ts';
import * as webCorrelation from '../src/components/sections/web/web-correlation-content.ts';
import { DISCOVERY_FILE_TYPES } from '../src/components/seo/agent-discovery.ts';

function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`repository root not found from ${process.cwd()}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const SECTIONS_DIR = resolve(REPO_ROOT, 'apps/website/src/components/sections');
const PAGES_DIR = resolve(REPO_ROOT, 'apps/website/src/pages');
const readRepo = (path: string): string => readFileSync(resolve(REPO_ROOT, path), 'utf8');
/** Collapse whitespace and drop backticks and `*` markers: wrapped sources compare as prose. */
const normalize = (text: string): string => text.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();

type Source = { readonly file: string; readonly phrase: string };
type Claim = { name: string; text: string; sources: readonly Source[] };
type Excerpt = { name: string; file: string; code: string };

const claims: Claim[] = [
  ...layers.LADDER_STAGES.flatMap((stage) =>
    (['web', 'native'] as const).map((side) => ({
      name: `ladder ${stage.name} (${side})`,
      text: stage.runtimes[side].text,
      sources: stage.runtimes[side].sources,
    }))
  ),
  { name: 'portability lede', ...portability.PORTABILITY_LEDE },
  ...portability.PORTABILITY_STEPS.map((step) => ({
    name: `portability step ${step.title}`,
    text: step.body,
    sources: step.sources,
  })),
  ...portability.PORTABILITY_LIMITS.map((limit, index) => ({
    name: `portability limit ${index + 1}`,
    text: limit.text,
    sources: limit.sources,
  })),
  { name: 'why-kmp lede', ...whyKmp.WHY_KMP_LEDE },
  ...whyKmp.WHY_KMP_CLAIMS.map((claim) => ({
    name: `why-kmp ${claim.title}`,
    text: claim.body,
    sources: claim.sources,
  })),
  { name: 'why-kmp how', ...whyKmp.WHY_KMP_HOW_INTRO },
  ...whyKmp.WHY_KMP_STEPS.map((step, index) => ({
    name: `why-kmp step ${index + 1}`,
    text: step.code ? `${step.code} ${step.rest}` : step.rest,
    sources: step.sources,
  })),
  { name: 'why-kmp token note', ...whyKmp.WHY_KMP_TOKEN_NOTE },
  { name: 'why-kmp status', ...whyKmp.WHY_KMP_STATUS },
];

const excerpts: Excerpt[] = [
  ...portability.PORTABILITY_EXCERPTS.map((excerpt) => ({
    name: 'portability',
    file: excerpt.file,
    code: excerpt.segments.map((segment) => segment.text).join(''),
  })),
  ...whyKmp.WHY_KMP_EXCERPTS.map((excerpt) => ({ name: 'why-kmp', ...excerpt })),
  ...webCorrelation.WEB_CORR_PANELS.flatMap((panel) =>
    panel.excerpts.map((excerpt) => ({ name: `correlation ${panel.id}`, ...excerpt }))
  ),
];

describe('claims and excerpts are anchored in the repository (no drift)', () => {
  it('every cited phrase is in its file and in the claim that cites it', () => {
    expect(claims.flatMap((claim) => claim.sources).length).toBeGreaterThan(20);
    for (const limit of portability.PORTABILITY_LIMITS)
      expect(limit.sources.length).toBeGreaterThan(0);
    for (const claim of claims) {
      for (const { file, phrase } of claim.sources) {
        const where = `${claim.name} → ${file}: "${phrase}"`;
        expect(normalize(readRepo(file)), where).toContain(normalize(phrase));
        expect(normalize(claim.text), where).toContain(normalize(phrase));
      }
    }
  });

  it('every code excerpt is a byte-for-byte slice of the file it names', () => {
    expect(excerpts.length).toBeGreaterThanOrEqual(9);
    for (const excerpt of excerpts) {
      expect(readRepo(excerpt.file), `${excerpt.name} → ${excerpt.file}`).toContain(excerpt.code);
    }
    // The shared strings the portability and correlation demos highlight are real.
    const kotlin = readRepo(portability.KOTLIN_PROJECTION_FILE);
    expect(readRepo(portability.MANIFEST_FILE)).toContain(portability.SHARED_SUMMARY);
    expect(kotlin).toContain(portability.SHARED_SUMMARY);
    expect(kotlin).toContain(portability.SHARED_ID);
    for (const panel of webCorrelation.WEB_CORR_PANELS) {
      const code = panel.excerpts.map((excerpt) => excerpt.code).join('\n');
      expect(code, panel.id).toContain(webCorrelation.WEB_CORR_SHARED_STRING);
    }
  });

  it('every parity surface, native module path and registry fact exists', () => {
    const registry = readRepo('native/README.md');
    for (const row of parity.PARITY_ROWS) {
      for (const cell of [row.web, row.native]) {
        expect(
          existsSync(resolve(REPO_ROOT, cell.surface)),
          `${row.capability}: ${cell.surface}`
        ).toBe(true);
      }
    }
    for (const module of nativeEvidence.NATIVE_MODULES) {
      expect(existsSync(resolve(REPO_ROOT, module.path)), module.path).toBe(true);
    }
    for (const fact of nativeEvidence.REGISTRY_FACTS) expect(registry, fact).toContain(fact);
  });
});

describe('the layer data is the documented and enforced graph', () => {
  it('matches docs/ARCHITECTURE.md row for row and scripts/check-layers.ts layer for layer, down only', () => {
    const doc = readRepo('docs/ARCHITECTURE.md');
    const section = doc.slice(
      doc.indexOf('## The layer graph'),
      doc.indexOf('## Package subpaths')
    );
    const docRows = section
      .split('\n')
      .map((line) =>
        line
          .trim()
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim())
      )
      .filter((cells) => cells.length === 4 && /^L\d+$/.test(cells[0] ?? ''))
      .map(([label, packageCell, role, dependencyCell]) => ({
        label,
        name: /^`([^`]+)`$/.exec(packageCell ?? '')?.[1],
        role: normalize(role ?? ''),
        dependsOn:
          dependencyCell === 'none'
            ? []
            : (dependencyCell ?? '')
                .split(',')
                .map((dependency) => dependency.trim())
                .filter(Boolean),
      }))
      .filter((row) => row.name !== undefined);
    expect(docRows.length).toBeGreaterThanOrEqual(16);

    const data = layers.ARCH_LAYERS.flatMap((layer) =>
      layer.packages.map((pkg) => ({
        label: layer.label,
        name: pkg.name,
        role: normalize(pkg.role),
        dependsOn: [...pkg.dependsOn],
      }))
    );
    expect(data).toEqual(docRows);

    const layerOf = new Map(data.map((pkg) => [pkg.name, Number(pkg.label.slice(1))]));
    expect(Object.fromEntries(layerOf)).toEqual(GUARD_LAYERS);
    const edges = new Set<string>();
    for (const pkg of data) {
      for (const dep of pkg.dependsOn) {
        const target = layerOf.get(dep === 'texuli' ? 'texuli' : `@texuli/${dep}`);
        expect(target, `${pkg.name} depends on ${dep}`).toBeLessThan(layerOf.get(pkg.name) ?? -1);
        edges.add(`${layerOf.get(pkg.name)}->${target}`);
      }
    }
    expect(new Set(layers.LAYER_EDGES.map((edge) => `${edge.from}->${edge.to}`))).toEqual(edges);
  });
});

/** An on-site href resolves to a page, a dynamic page, or a public file. */
/** Files the build generates from typed sources (agent-discovery.ts), not committed. */
const GENERATED_FILES = new Set(DISCOVERY_FILE_TYPES.map((file) => file.path));

function routeExists(href: string): boolean {
  if (GENERATED_FILES.has(href)) return true;
  if (!href.endsWith('/')) return existsSync(join(REPO_ROOT, 'apps/website/public', href));
  const page = join(PAGES_DIR, href);
  if (existsSync(join(page, 'index.astro')) || existsSync(`${page.replace(/\/$/, '')}.astro`)) {
    return true;
  }
  const parent = dirname(page.replace(/\/$/, ''));
  return (
    existsSync(parent) && readdirSync(parent).some((entry) => /^\[[^\]]+\]\.astro$/.test(entry))
  );
}

function sectionTemplates(): { file: string; source: string }[] {
  return readdirSync(SECTIONS_DIR, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.astro'))
    .map((file) => ({ file, source: readFileSync(join(SECTIONS_DIR, file), 'utf8') }));
}

describe('links and sinks', () => {
  it('every section link is a path-only on-site route that exists', () => {
    const hrefs = [
      ...home.HOME_HERO.actions,
      ...home.HOME_PITCH.steps,
      ...home.HOME_STORIES.flatMap((story) => [
        ...(story.points ?? []).flatMap((point) =>
          point.href === undefined ? [] : [{ href: point.href }]
        ),
        ...(story.chips ?? []),
        ...(story.actions ?? []),
      ]),
      ...home.HOME_FINAL.actions,
      webCorrelation.WEB_CORR_DEMO_LINK,
      webCorrelation.WEB_CORR_ARCH_LINK,
      ...portability.PORTABILITY_LINKS,
      ...nativeEvidence.NATIVE_LINKS,
      ...nativeHero.nativeHeroContent.links,
    ].map((link) => link.href);
    hrefs.push(whyKmp.WHY_KMP_GUIDE_HREF, whyKmp.WHY_KMP_ARCHITECTURE_HREF);
    expect(hrefs.length).toBeGreaterThan(25);
    for (const href of hrefs) {
      expect(href, href).toMatch(/^\/(?!\/)/);
      expect(routeExists(href), `missing route or file: ${href}`).toBe(true);
    }
  });

  it('templates write no HTML sink and no literal href; links go through withBase or safeHref', () => {
    const templates = sectionTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(10);
    for (const { file, source } of templates) {
      for (const sink of ['{@html', 'set:html', 'innerHTML', 'dangerouslySetInnerHTML']) {
        expect(source, `${file} uses ${sink}`).not.toContain(sink);
      }
      expect(source.match(/href="\/[^"]*"/g) ?? [], file).toEqual([]);
      if (/<a\b/.test(source)) expect(source, file).toMatch(/withBase\(|safeHref\(/);
    }
    for (const file of [
      'home/HomeHero.astro',
      'home/HomePitch.astro',
      'home/LandingStory.astro',
      'home/HomeProof.astro',
      'home/HomeQuickstart.astro',
      'home/HomeFinal.astro',
    ]) {
      expect(readFileSync(join(SECTIONS_DIR, file), 'utf8'), file).toContain(
        "safeHref(href, 'developer')"
      );
    }
  });
});

describe('honesty', () => {
  it('no section promises what is not shipped', () => {
    const copy = JSON.stringify([
      layers,
      parity,
      portability,
      nativeEvidence,
      nativeHero,
      whyKmp,
      home,
      webCorrelation,
    ]);
    for (const banned of [/coming soon/i, /production-ready/i, /write once/i, /iOS today/i]) {
      expect(copy, String(banned)).not.toMatch(banned);
    }
    // Planned stays planned: the parity table never marks a native capability shipped.
    const statuses = new Set(
      parity.PARITY_ROWS.flatMap((row) => [row.web.status, row.native.status])
    );
    expect([...statuses].every((status) => ['exists', 'in-repo', 'planned'].includes(status))).toBe(
      true
    );
  });
});

describe('native claims follow the generated parity matrix (PLAN_012)', () => {
  const parityJson = JSON.parse(readRepo('native/docs/parity.json')) as {
    totals: { painted: number; catalog: number; agentEmittable: number; goldenTraces: number };
  };

  it('reads every native count on the site from native/docs/parity.json', () => {
    expect(nativeParity.NATIVE_SLICE).toEqual({
      painted: parityJson.totals.painted,
      total: parityJson.totals.catalog,
      goldenTraces: parityJson.totals.goldenTraces,
    });
    expect(nativeParity.NATIVE_CHARTS.painted).toEqual([
      'charts-bullet',
      'charts-gauge',
      'charts-progress-ring',
      'charts-sparkline',
    ]);
    const shipped = nativeEvidence.NATIVE_SHIPPED.join(' ');
    expect(shipped).toContain(
      `paints ${parityJson.totals.painted} of the ${parityJson.totals.catalog}`
    );
    const charts = parity.PARITY_ROWS.find((row) => row.capability === 'Charts');
    expect(charts?.native.detail).toContain(
      `of ${nativeParity.NATIVE_CHARTS.total} chart components`
    );
  });

  it('carries no stale native count or claim in the docs or on the site', () => {
    const sources = [
      readRepo('native/README.md'),
      readRepo('native/docs/ADOPTION.md'),
      JSON.stringify([parity, nativeEvidence, nativeHero]),
    ].join('\n');
    for (const stale of [
      /\b133 (?:spec )?vocabulary/,
      /\b41 (?:may be emitted|emittable)/,
      /other 92\b/,
      /all nine spec goldens/,
      /all four goldens/,
      /full engine generated from the spec.s token roles is planned/,
    ])
      expect(sources, String(stale)).not.toMatch(stale);
    expect(readRepo('native/docs/ADOPTION.md')).toContain('[PARITY.md](PARITY.md)');
    expect(readRepo('native/README.md')).toContain('[web ↔ native parity matrix](docs/PARITY.md)');
  });
});

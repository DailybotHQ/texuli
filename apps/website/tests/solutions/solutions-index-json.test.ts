import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { LISTED_PRODUCTS } from '../../src/data/products/index.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import {
  SOLUTION_PLATFORMS,
  SOLUTION_SLUGS,
  SOLUTION_STATUSES,
  type SolutionPlatform,
  type SolutionSlug,
  type SolutionStatus,
} from '../../src/data/solutions/schema.ts';
import { SOLUTIONS_INDEX_FORMAT, solutionsIndexDocument } from '../../src/lib/twins/solutions.ts';

const ROOT = resolve(import.meta.dirname, '../../../..');
const WEBSITE = resolve(import.meta.dirname, '../..');
const SITE = 'https://texuli.com';
const ENDPOINT = readFileSync(resolve(WEBSITE, 'src/pages/solutions/index.json.ts'), 'utf8');

const STATUS_RANK: Readonly<Record<SolutionStatus, number>> = {
  planned: 0,
  experimental: 1,
  'in development': 2,
  available: 3,
};

/** Parity.json capability that covers each Solution on Compose Desktop (`validate.ts`). */
const PARITY_CAPABILITY: Readonly<Record<SolutionSlug, string>> = {
  slides: 'Decks',
  documents: 'Documents, forms, canvas and sheets',
  workflows: 'Workflows',
  canvas: 'Documents, forms, canvas and sheets',
  sheets: 'Documents, forms, canvas and sheets',
  'design-systems': 'Design systems and tokens',
  dashboards: 'Data views and dashboards',
  forms: 'Documents, forms, canvas and sheets',
  'agent-chat': 'Agent tools (MCP)',
  editor: 'Documents, forms, canvas and sheets',
};

interface IndexSolution {
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly tagline: string;
  readonly summary: string;
  readonly url: string;
  readonly docs: string | null;
  readonly markdown: string;
  readonly packages: readonly { name: string; subpaths: readonly string[]; role: string }[];
  readonly capabilities: readonly { id: string; title: string; status: string }[];
  readonly platforms: readonly {
    platform: string;
    status: string;
    evidence: readonly string[];
  }[];
  readonly demo: { scenarios: readonly string[]; limits: readonly string[] };
  readonly limits: readonly string[];
}

interface IndexProduct {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly summary: string;
  readonly url: string;
}

interface IndexDocument {
  readonly format: string;
  readonly source: string;
  readonly catalog: string | null;
  readonly solutions: readonly IndexSolution[];
  readonly products: readonly IndexProduct[];
}

interface ParityFile {
  readonly capabilities?: readonly { name: string; status: string }[];
}

function asIndex(value: ReturnType<typeof solutionsIndexDocument>): IndexDocument {
  return value as unknown as IndexDocument;
}

function packageExports(): ReadonlyMap<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();
  for (const dir of readdirSync(join(ROOT, 'packages'))) {
    const file = join(ROOT, 'packages', dir, 'package.json');
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as {
      name?: unknown;
      exports?: unknown;
    };
    if (typeof manifest.name !== 'string') continue;
    const keys = new Set<string>();
    if (
      manifest.exports &&
      typeof manifest.exports === 'object' &&
      !Array.isArray(manifest.exports)
    ) {
      for (const key of Object.keys(manifest.exports)) keys.add(key);
    }
    map.set(manifest.name, keys);
  }
  return map;
}

function ceilingFromParity(status: string): SolutionStatus {
  if (status === 'parity' || status === 'partial') return 'in development';
  if (status === 'validation-only') return 'experimental';
  return 'planned';
}

function nativeCeiling(
  slug: SolutionSlug,
  platform: SolutionPlatform,
  parity: ParityFile
): SolutionStatus {
  if (platform === 'android' || platform === 'ios') return 'planned';
  const row = parity.capabilities?.find(
    (capability) => capability.name === PARITY_CAPABILITY[slug]
  );
  if (!row) throw new Error(`parity.json has no capability for ${slug} on ${platform}`);
  return ceilingFromParity(row.status);
}

describe('/solutions/index.json endpoint', () => {
  it('is a static GET over solutionsIndexDocument, with no filesystem reads', () => {
    expect(ENDPOINT).toContain('export function GET()');
    expect(ENDPOINT).toContain('solutionsIndexDocument(SITE_URL)');
    expect(ENDPOINT).toContain("import { SITE_URL } from '../../lib/constances'");
    expect(ENDPOINT).toContain("'content-type': 'application/json; charset=utf-8'");
    expect(ENDPOINT).not.toMatch(/import\.meta\.dirname|readFileSync|node:fs/);
  });
});

describe('/solutions/index.json document', () => {
  const doc = asIndex(solutionsIndexDocument(SITE));
  const existing = SOLUTIONS.filter((entry) => siteRouteExists(entry.route));
  const packages = packageExports();
  const parity = JSON.parse(
    readFileSync(join(ROOT, 'native/docs/parity.json'), 'utf8')
  ) as ParityFile;

  it('names its format (schema version v1) and the registry source', () => {
    expect(doc.format).toBe(SOLUTIONS_INDEX_FORMAT);
    expect(doc.format).toBe('texuli/solutions-index-v1');
    expect(doc.source).toBe('apps/website/src/data/solutions/index.ts');
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it('lists the catalog and every Solution whose landing exists, in registry order, with stable ids', () => {
    expect(doc.catalog).toBe(`${SITE}/solutions/`);
    expect(doc.solutions.map((row) => row.slug)).toEqual(existing.map((entry) => entry.slug));
    expect(existing.map((entry) => entry.slug).length).toBeGreaterThan(0);
    for (const slug of doc.solutions.map((row) => row.slug)) {
      expect(SOLUTION_SLUGS, slug).toContain(slug);
    }
    expect(doc.products.map((row) => row.id)).toEqual(LISTED_PRODUCTS.map((product) => product.id));
    for (const row of doc.products) expect(row.id).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('equals the registry on name, status, packages, platforms, capabilities and limits', () => {
    expect(doc.solutions).toHaveLength(existing.length);
    for (const [i, row] of doc.solutions.entries()) {
      const entry = existing[i];
      if (!entry) throw new Error(`missing registry entry at ${i}`);
      expect(row.slug).toBe(entry.slug);
      expect(row.name).toBe(entry.name);
      expect(row.status).toBe(entry.status);
      expect(row.tagline).toBe(entry.tagline);
      expect(row.summary).toBe(entry.summary);
      expect(row.url).toBe(`${SITE}${entry.route}`);
      expect(row.markdown).toBe(`${SITE}${entry.route.replace(/\/$/, '')}.md`);
      expect(row.packages).toEqual(
        entry.packages.map((pkg) => ({
          name: pkg.name,
          subpaths: [...pkg.subpaths],
          role: pkg.role,
        }))
      );
      expect(row.capabilities).toEqual(
        entry.capabilities.map((cap) => ({ id: cap.id, title: cap.title, status: cap.status }))
      );
      expect(row.platforms).toEqual(
        entry.platforms.map((platform) => ({
          platform: platform.platform,
          status: platform.status,
          evidence: [...platform.evidence],
        }))
      );
      expect(row.demo).toEqual({
        scenarios: [...entry.demo.scenarios],
        limits: [...entry.demo.limits],
      });
      expect(row.limits).toEqual([...entry.limits]);
    }
  });

  it('uses only the honest status vocabulary', () => {
    for (const row of doc.solutions) {
      expect(SOLUTION_STATUSES, row.slug).toContain(row.status);
      for (const cap of row.capabilities) {
        expect(SOLUTION_STATUSES, `${row.slug} ${cap.id}`).toContain(cap.status);
      }
      for (const platform of row.platforms) {
        expect(SOLUTION_PLATFORMS, `${row.slug} ${platform.platform}`).toContain(platform.platform);
        expect(SOLUTION_STATUSES, `${row.slug} ${platform.platform}`).toContain(platform.status);
      }
    }
    for (const row of doc.products) expect(SOLUTION_STATUSES, row.id).toContain(row.status);
  });

  it('names packages that exist in packages/*/package.json, with real subpath exports', () => {
    expect(packages.size).toBeGreaterThan(0);
    for (const row of doc.solutions) {
      for (const pkg of row.packages) {
        const exports = packages.get(pkg.name);
        expect(exports, pkg.name).toBeDefined();
        for (const sub of pkg.subpaths) {
          expect(exports?.has(sub), `${pkg.name} ${sub}`).toBe(true);
        }
      }
    }
  });

  it('never lists a native platform status above native/docs/parity.json', () => {
    for (const row of doc.solutions) {
      const slug = row.slug as SolutionSlug;
      for (const platform of row.platforms) {
        if (platform.platform === 'web') continue;
        const ceiling = nativeCeiling(slug, platform.platform as SolutionPlatform, parity);
        expect(
          STATUS_RANK[platform.status as SolutionStatus],
          `${row.slug} ${platform.platform} ${platform.status} vs ${ceiling}`
        ).toBeLessThanOrEqual(STATUS_RANK[ceiling]);
      }
    }
  });

  it('sets docs to null when the docs page is missing, and to the absolute URL when it exists', () => {
    const none = asIndex(solutionsIndexDocument(SITE, () => false));
    expect(none.catalog).toBeNull();
    expect(none.solutions).toEqual([]);
    expect(none.products).toEqual([]);

    const slides = SOLUTIONS.find((entry) => entry.slug === 'slides');
    if (!slides) throw new Error('slides entry');
    const landingOnly = asIndex(
      solutionsIndexDocument(SITE, (route) => route === '/solutions/' || route === slides.route)
    );
    expect(landingOnly.solutions).toHaveLength(1);
    expect(landingOnly.solutions[0]?.docs).toBeNull();
    expect(landingOnly.solutions[0]?.url).toBe(`${SITE}${slides.route}`);

    for (const [i, row] of doc.solutions.entries()) {
      const entry = existing[i];
      if (!entry) throw new Error(`missing registry entry at ${i}`);
      if (siteRouteExists(entry.docs)) expect(row.docs).toBe(`${SITE}${entry.docs}`);
      else expect(row.docs).toBeNull();
    }
  });

  it('matches dist/solutions/index.json when the site has been built', () => {
    const built = join(WEBSITE, 'dist/solutions/index.json');
    if (!existsSync(built)) return;
    const fromDist = JSON.parse(readFileSync(built, 'utf8')) as IndexDocument;
    expect(fromDist).toEqual(doc);
  });
});

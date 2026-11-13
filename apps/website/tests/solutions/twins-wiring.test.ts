import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { texuliEdgeOps } from '@texuli/tools/ops';
import { afterAll, describe, expect, it } from 'vitest';
import { checkDist } from '../../scripts/solutions-surfaces.ts';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { LISTED_PRODUCTS, PRODUCTS } from '../../src/data/products/index.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import { negotiateTwin } from '../../src/lib/md-negotiate.ts';
import {
  packageDir,
  productRoute,
  registryLlmsSections,
  registryRoutes,
  SOLUTIONS_INDEX_FORMAT,
  solutionsIndexDocument,
  solutionTwinNotes,
} from '../../src/lib/twins/solutions.ts';

const SITE = 'https://texuli.com';
const all = () => true;
const none = () => false;
const only =
  (...routes: string[]) =>
  (route: string) =>
    routes.includes(route);

describe('registry routes', () => {
  it('list only pages that exist, in catalog order, with listed products only', () => {
    expect(registryRoutes(none)).toEqual([]);
    const routes = registryRoutes(all);
    expect(routes[0]).toEqual({ route: '/solutions/', kind: 'catalog', title: 'Solutions' });
    expect(routes.filter((r) => r.kind === 'solution').map((r) => r.route)).toEqual(
      SOLUTIONS.map((s) => s.route)
    );
    expect(routes.filter((r) => r.kind === 'solution-docs').map((r) => r.route)).toEqual(
      SOLUTIONS.map((s) => s.docs)
    );
    const productRoutes = routes.filter((r) => r.kind === 'product').map((r) => r.route);
    expect(productRoutes).toEqual(LISTED_PRODUCTS.map(productRoute));
    for (const product of PRODUCTS.filter((p) => p.visibility !== 'listed'))
      expect(productRoutes).not.toContain(productRoute(product));
  });

  it('match the pages in this checkout (the same rule as the nav)', () => {
    for (const { route } of registryRoutes()) expect(siteRouteExists(route), route).toBe(true);
    const expected = [
      '/solutions/',
      ...SOLUTIONS.flatMap((s) => [s.route, s.docs]),
      '/built-with/',
      ...LISTED_PRODUCTS.map(productRoute),
    ].filter(siteRouteExists);
    expect(registryRoutes().map((r) => r.route)).toEqual(expected);
  });

  it('each negotiate to a Markdown twin path through the middleware rule', () => {
    for (const { route } of registryRoutes(all)) {
      expect(negotiateTwin(route, 'text/markdown')?.twin, route).toBe(
        `${route.replace(/\/$/, '')}.md`
      );
    }
  });
});

describe('/solutions/index.json', () => {
  it('lists registry facts for existing landings only, with null for missing docs', () => {
    expect(solutionsIndexDocument(SITE, none)).toEqual({
      format: SOLUTIONS_INDEX_FORMAT,
      source: 'apps/website/src/data/solutions/index.ts',
      catalog: null,
      solutions: [],
      products: [],
    });
    const slides = SOLUTIONS.find((s) => s.slug === 'slides');
    if (!slides) throw new Error('slides entry');
    const doc = solutionsIndexDocument(SITE, only('/solutions/', slides.route));
    expect(doc.catalog).toBe(`${SITE}/solutions/`);
    expect(doc.solutions).toHaveLength(1);
    const [row] = doc.solutions as Array<Record<string, unknown>>;
    expect(row?.url).toBe(`${SITE}/solutions/slides/`);
    expect(row?.docs).toBeNull();
    expect(row?.markdown).toBe(`${SITE}/solutions/slides.md`);
    expect(row?.status).toBe(slides.status);
    expect(row?.platforms).toEqual(
      slides.platforms.map((p) => ({ ...p, evidence: [...p.evidence] }))
    );
  });

  it('is plain JSON and never upgrades a status', () => {
    const doc = solutionsIndexDocument(SITE, all);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    for (const [i, row] of (doc.solutions as Array<Record<string, unknown>>).entries())
      expect(row.status).toBe(SOLUTIONS[i]?.status);
    for (const row of doc.products as Array<Record<string, unknown>>) {
      const product = LISTED_PRODUCTS.find((p) => p.id === row.id);
      expect(row.status).toBe(product?.status);
    }
  });
});

describe('llms.txt sections', () => {
  it('are omitted until a page exists, then link only existing pages', () => {
    expect(registryLlmsSections(SITE, none)).toEqual([]);
    const sections = registryLlmsSections(SITE, all);
    expect(sections.map((s) => s.name)).toEqual(['Solutions', 'Built with Texuli']);
    const slides = SOLUTIONS[0];
    if (!slides) throw new Error('entry');
    const partial = registryLlmsSections(SITE, only(slides.route));
    expect(partial).toHaveLength(1);
    expect(partial[0]?.links.map((l) => l.href)).toEqual([`${SITE}${slides.route}`]);
    expect(partial[0]?.links[0]?.description).toContain(`Status: ${slides.status}.`);
    for (const section of sections)
      for (const link of section.links) expect(link.href.startsWith(`${SITE}/`)).toBe(true);
  });

  it('match the routes in this checkout', () => {
    const hrefs = registryLlmsSections(SITE).flatMap((s) => s.links.map((l) => l.href));
    for (const href of hrefs) {
      const route = href.slice(SITE.length);
      if (route === '/solutions/index.json') expect(siteRouteExists('/solutions/')).toBe(true);
      else expect(siteRouteExists(route), route).toBe(true);
    }
  });
});

describe('twin notes for demo landings', () => {
  const served = new Set(texuliEdgeOps.list({ runtimes: ['edge'] }).map((op) => op.name));

  it('cover each existing landing, name served MCP operations and real package READMEs', () => {
    expect(solutionTwinNotes(none)).toEqual([]);
    const notes = solutionTwinNotes(all);
    expect(notes).toHaveLength(SOLUTIONS.length);
    for (const [i, note] of notes.entries()) {
      const entry = SOLUTIONS[i];
      if (!entry) throw new Error('entry');
      expect(note.route.test(entry.route)).toBe(true);
      expect(note.route.test(`${entry.route}x/`)).toBe(false);
      expect(note.demo).toContain(entry.demo.title);
      const operations = note.operations ?? [];
      for (const op of operations) expect(served.has(op), `${entry.slug} ${op}`).toBe(true);
      for (const dir of note.packages)
        expect(existsSync(resolve(`packages/${dir}/README.md`)), dir).toBe(true);
      for (const link of note.links) expect(link.href).toBe(entry.docs);
    }
    expect(packageDir('@texuli/slides')).toBe('slides');
    expect(packageDir('texuli')).toBe('texuli');
  });
});

describe('dist check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tx-solutions-dist-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reports a missing sitemap, and nothing else while no registry page exists', () => {
    const problems = checkDist(dir);
    expect(problems[0]).toBe('dist/sitemap.xml is missing');
    if (registryRoutes().length === 0) expect(problems).toHaveLength(1);
    writeFileSync(join(dir, 'sitemap.xml'), '<urlset></urlset>');
    if (registryRoutes().length === 0) expect(checkDist(dir)).toEqual([]);
  });

  it('flags a registry page without its twin or sitemap entry, and passes when both exist', () => {
    const routes = [{ route: '/solutions/slides/' }];
    mkdirSync(join(dir, 'solutions', 'slides'), { recursive: true });
    writeFileSync(join(dir, 'solutions', 'slides', 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'sitemap.xml'), '<urlset></urlset>');
    expect(checkDist(dir, SITE, routes)).toEqual([
      '/solutions/slides/: no Markdown twin',
      '/solutions/slides/: not in sitemap.xml',
    ]);
    writeFileSync(join(dir, 'solutions', 'slides.md'), '# Slides');
    writeFileSync(
      join(dir, 'sitemap.xml'),
      `<urlset><url><loc>${SITE}/solutions/slides/</loc></url></urlset>`
    );
    expect(checkDist(dir, SITE, routes)).toEqual([]);
    expect(checkDist(dir, SITE, [{ route: '/solutions/sheets/' }])).toEqual([
      '/solutions/sheets/: no built page',
      '/solutions/sheets/: no Markdown twin',
      '/solutions/sheets/: not in sitemap.xml',
    ]);
  });
});

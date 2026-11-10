import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOLUTION_REDIRECTS } from '../../../../functions/_middleware.ts';
import { ecosystemNavGroups, solutionNavLinks } from '../../src/components/foundation/nav-data.ts';
import { GUIDES_SECTIONS } from '../../src/components/guides/nav.ts';
import { DESIGN_SYSTEMS_DEMO_LIMITS } from '../../src/components/solutions/design-systems/demo/demo-content.ts';
import { DEMO_BRAND_INPUTS } from '../../src/components/solutions/design-systems/demo/fixtures/brands.ts';
import { getSolution, SOLUTIONS } from '../../src/data/solutions/index.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';
import {
  registryLlmsSections,
  registryRoutes,
  solutionsIndexDocument,
  solutionTwinNotes,
} from '../../src/lib/twins/solutions.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const HUB = readFileSync(resolve(WEBSITE, 'src/pages/design-systems/index.astro'), 'utf8');
const LANDING = readFileSync(
  resolve(WEBSITE, 'src/pages/solutions/design-systems/index.astro'),
  'utf8'
);

describe('Design systems Solution registry wiring (ADR-033)', () => {
  const entry = getSolution('design-systems');

  it('uses the route ADR without replacing the reference hub or kit', () => {
    expect(entry).toMatchObject({
      slug: 'design-systems',
      route: '/solutions/design-systems/',
      docs: '/guides/solutions/design-systems/',
      status: 'available',
    });
    expect(entry.replaces).toBeUndefined();
    expect(validateSolutionRegistry([entry], { requireRoutes: true })).toEqual({
      issues: [],
      planned: [],
    });
    expect(SOLUTION_REDIRECTS.some((redirect) => redirect.from.includes('design-systems'))).toBe(
      false
    );
  });

  it('flows into the catalog, footer navigation, JSON, llms and Markdown twin data', () => {
    expect(SOLUTIONS.at(-1)).toEqual(entry);
    expect(solutionNavLinks()).toContainEqual({ href: entry.route, label: entry.name });
    expect(GUIDES_SECTIONS.flatMap((section) => section.items).map((item) => item.href)).toContain(
      entry.docs
    );
    expect(ecosystemNavGroups().find((group) => group.id === 'solutions')?.links).toContainEqual({
      href: '/solutions/',
      label: 'All Solutions',
    });
    expect(registryRoutes().map((route) => route.route)).toContain(entry.route);
    expect(registryRoutes().map((route) => route.route)).toContain(entry.docs);

    const siteUrl = 'https://texuli.com';
    const index = solutionsIndexDocument(siteUrl);
    expect(index.solutions.find((solution) => solution.slug === entry.slug)).toMatchObject({
      url: `${siteUrl}${entry.route}`,
      docs: `${siteUrl}${entry.docs}`,
    });
    const links = registryLlmsSections(siteUrl).find(
      (section) => section.name === 'Solutions'
    )?.links;
    expect(links?.map((link) => link.href)).toContain(`${siteUrl}${entry.route}`);
    expect(links?.map((link) => link.href)).toContain(`${siteUrl}${entry.docs}`);

    const twin = solutionTwinNotes().find((note) => note.route.test(entry.route));
    expect(twin?.operations).toEqual(['ds.validate', 'ds.generate', 'ds.compile']);
    expect(twin?.packages).toEqual(['spec', 'tokens', 'texuli', 'tools']);
    // W-1: the twin and the index describe the shipped demo, in the island's own words.
    expect(twin?.demo).toBe(
      `Lock a brand in a minute: the live Design systems demo runs in the browser on fixture data. ${DESIGN_SYSTEMS_DEMO_LIMITS}`
    );
    expect(entry.demo.title).toBe('Lock a brand in a minute');
    expect(entry.demo.scenarios).toEqual(['harborline', 'quillmark', 'tumbletown']);
    expect(entry.demo.limits).toEqual([DESIGN_SYSTEMS_DEMO_LIMITS]);
    expect(index.solutions.find((solution) => solution.slug === entry.slug)).toMatchObject({
      demo: {
        scenarios: ['harborline', 'quillmark', 'tumbletown'],
        limits: [DESIGN_SYSTEMS_DEMO_LIMITS],
      },
    });
    expect(DEMO_BRAND_INPUTS.map((brand) => brand.id)).toEqual(entry.demo.scenarios);
  });

  it('links the existing reference hub to the finished landing', () => {
    expect(HUB).toContain("safeHref('/solutions/design-systems/', 'developer')");
    expect(HUB).toContain('Explore the Design Systems Solution');
    expect(HUB).toContain('ds-hub__solution-link');
    expect(LANDING).toContain('<SolutionLayout');
    expect(LANDING).toContain('<DesignSystemsStories slot="stories" />');
    expect(LANDING).not.toContain('This Solution landing is being completed.');
  });
});

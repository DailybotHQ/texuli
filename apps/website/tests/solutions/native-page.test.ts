import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nativeHeroStatus } from '../../src/components/sections/native/hero/hero-content.ts';
import {
  NATIVE_MATRIX_GROUP_COUNTS,
  NATIVE_MATRIX_ROUTE,
  NATIVE_MATRIX_ROWS,
  NATIVE_MATRIX_TOTALS,
} from '../../src/components/sections/native/matrix/matrix-data.ts';
import { NATIVE_PLANNED } from '../../src/components/sections/native/native-evidence-data.ts';
import { siteLlmsSections } from '../../src/components/seo/llms-site.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const read = (path: string) => readFileSync(resolve(WEBSITE, path), 'utf8');
const PAGE = read('src/pages/native/index.astro');
const frontmatterEnd = PAGE.indexOf('---', 3) + 3;
const markup = PAGE.slice(frontmatterEnd);

/** The section components, in page order, with their source. */
const SECTIONS = [
  ['NativeHero', 'src/components/sections/native/hero/NativeHero.astro'],
  ['BlueprintDiagram', 'src/components/sections/native/blueprint/BlueprintDiagram.astro'],
  ['NativeDemo', 'src/components/sections/native/demo/NativeDemo.astro'],
  ['WhyKmp', 'src/components/sections/native/WhyKmp.astro'],
  ['ComponentsThatTravel', 'src/components/sections/native/travel/ComponentsThatTravel.astro'],
  ['ComplexSolutionsTravel', 'src/components/sections/native/travel/ComplexSolutionsTravel.astro'],
  ['NativeMatrixSummary', 'src/components/sections/native/matrix/NativeMatrixSummary.astro'],
  ['NativeEvidenceRoadmap', 'src/components/sections/native/NativeEvidenceRoadmap.astro'],
  ['NativeFaq', 'src/components/sections/native/faq/NativeFaq.astro'],
  ['NativePrinciples', 'src/components/sections/native/principles/NativePrinciples.astro'],
] as const;

describe('/native/ (Texuli Native, beyond the browser)', () => {
  it('assembles the moments in order, with the hero first and the start-building section last', () => {
    const order = [
      ...markup.matchAll(/<(Native\w+|BlueprintDiagram|WhyKmp|Components\w+|Complex\w+)\b/g),
    ].map((m) => m[1]);
    expect(order).toEqual(SECTIONS.map(([name]) => name));
    // The banner is off /native/ to keep the page inside its 122 KB budget.
    expect(markup).not.toContain('PageBanner');
    for (const [name, path] of SECTIONS)
      expect(PAGE, name).toContain(`/components/${path.replace('src/components/', '')}'`);
  });

  it('keeps exactly one h1, from the hero', () => {
    const h1s = SECTIONS.flatMap(([name, path]) =>
      (read(path).match(/<h1\b/g) ?? []).map(() => name)
    );
    expect(h1s).toEqual(['NativeHero']);
    expect(markup).not.toMatch(/<h1\b/);
  });

  it('hydrates exactly one island, the native demo, when visible', () => {
    expect(markup).not.toMatch(/client:/);
    const islands = SECTIONS.flatMap(([name, path]) =>
      [...read(path).matchAll(/\bclient:(\w+)/g)].map((m) => `${name}:${m[1]}`)
    );
    expect(islands).toEqual(['NativeDemo:visible']);
  });

  it('has no HTML sinks in the page or any section', () => {
    expect(PAGE).not.toMatch(/set:html|\{@html|innerHTML/);
    for (const [name, path] of SECTIONS)
      expect(read(path), name).not.toMatch(/set:html|\{@html|innerHTML/);
  });

  it('states platform status honestly, from the compatibility data', () => {
    const status = Object.fromEntries(nativeHeroStatus().map((row) => [row.id, row.status]));
    expect(status).toEqual({
      web: 'available',
      'compose-desktop': 'in development',
      android: 'planned',
      ios: 'planned',
    });
    expect(NATIVE_PLANNED.join(' ')).toMatch(/Maven Central .*planned/);
    expect(NATIVE_PLANNED.join(' ')).toMatch(/Android target/);
  });

  it('draws the matrix from parity.json and types no counts or versions in the page', () => {
    const parity = JSON.parse(readFileSync(resolve(REPO, 'native/docs/parity.json'), 'utf8')) as {
      totals: { catalog: number; painted: number };
    };
    expect(NATIVE_MATRIX_ROWS).toHaveLength(parity.totals.catalog);
    expect(NATIVE_MATRIX_TOTALS).toMatchObject(parity.totals);
    expect(markup).not.toMatch(/\d/);
    const head = PAGE.slice(
      PAGE.indexOf('<BaseLayout'),
      PAGE.indexOf('>', PAGE.indexOf('<BaseLayout'))
    );
    expect(head).not.toMatch(/\d/);
    expect(head).not.toMatch(/production[- ]ready|write once|run anywhere|coming soon/i);
  });

  it('stays listed for agents in llms.txt', () => {
    const links = siteLlmsSections('https://texuli.com').flatMap((s) => s.links.map((l) => l.href));
    expect(links).toContain('https://texuli.com/native/');
  });
});

describe('/native/compatibility/ (the full generated matrix)', () => {
  const COMPAT = read('src/pages/native/compatibility/index.astro');
  const SUMMARY = read('src/components/sections/native/matrix/NativeMatrixSummary.astro');

  it('is a static page with its own h1 and the full matrix', () => {
    expect(NATIVE_MATRIX_ROUTE).toBe('/native/compatibility/');
    expect(COMPAT).toContain('<NativeCompatibilityMatrix />');
    expect(COMPAT.match(/<h1\b/g)).toHaveLength(1);
    expect(COMPAT).not.toMatch(/client:|set:html|\{@html|innerHTML/);
    expect(
      read('src/components/sections/native/matrix/NativeCompatibilityMatrix.astro')
    ).not.toMatch(/client:/);
  });

  it('is linked from the /native/ summary, whose counts add up to the catalog', () => {
    expect(SUMMARY).toContain('safeHref(NATIVE_MATRIX_ROUTE');
    expect(SUMMARY).not.toMatch(/client:|set:html|\{@html/);
    const total = NATIVE_MATRIX_GROUP_COUNTS.reduce((sum, row) => sum + row.total, 0);
    const painted = NATIVE_MATRIX_GROUP_COUNTS.reduce((sum, row) => sum + row.painted, 0);
    expect(total).toBe(NATIVE_MATRIX_TOTALS.catalog);
    expect(painted).toBe(NATIVE_MATRIX_TOTALS.painted);
    expect(markup).not.toContain('<NativeCompatibilityMatrix');
  });

  it('keeps the matrix rows compact: one parity link for the table, not one per row', () => {
    const matrix = read('src/components/sections/native/matrix/NativeCompatibilityMatrix.astro');
    expect(matrix).toContain('NATIVE_MATRIX_ROWS.slice(0, 1).map((row)');
    expect(matrix).not.toContain('Parity catalog</a>');
  });
});

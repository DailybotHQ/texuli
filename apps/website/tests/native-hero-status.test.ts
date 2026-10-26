/**
 * Unit tests for the /native/ hero + status section (PLAN_006 T-45).
 *
 * There is no Astro renderer in the unit environment, so the section's copy
 * and structure live in the framework-free `native-hero-content.ts` module
 * (imported and pinned here directly), and the compiled `.astro` source is
 * read as text for the structural invariants only the markup can carry:
 * landmark wiring, the planned marker, motion and logical-property rules.
 * The built-page behavior is asserted by `tests/e2e/site-native.spec.ts`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { nativeHeroContent as content } from '../src/components/sections/native/native-hero-content.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SECTION_DIR = resolve(HERE, '../src/components/sections/native');
const PAGES_DIR = resolve(HERE, '../src/pages');
const componentSource = () => readFileSync(join(SECTION_DIR, 'NativeHeroStatus.astro'), 'utf8');
const styleBlock = () => {
  const match = componentSource().match(/<style>([\s\S]*)<\/style>/);
  expect(match, 'the component carries a <style> block').not.toBeNull();
  return match![1];
};

/** Every page route the site really ships, derived from `src/pages`. */
function deriveRoutes(dir: string, prefix = ''): Set<string> {
  const routes = new Set<string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (existsSync(join(dir, entry.name, 'index.astro'))) routes.add(`${rel}/`);
      for (const route of deriveRoutes(join(dir, entry.name), rel)) routes.add(route);
    } else if (entry.name.endsWith('.astro')) {
      const base = entry.name.replace(/\.astro$/, '');
      if (base !== 'index' && base !== '404') routes.add(`${rel}/`);
    }
  }
  return routes;
}

describe('native hero copy: the honest status (T-45)', () => {
  it('states the one-contract story and names both runtimes', () => {
    expect(content.title).toMatch(/the same catalog/i);
    expect(content.title).toContain('Compose');
    expect(content.lead).toContain('Kotlin Multiplatform');
    expect(content.lead).toMatch(/in development/i);
  });

  it('claims the web release exactly as it ships: 0.1.0-next.1, nothing else', () => {
    const allCopy = [content.eyebrow, content.title, content.lead, content.statusIntro].join(' ');
    const rowsCopy = content.statusRows.map((row) => `${row.term} ${row.detail}`).join(' ');
    const versionish = new Set(
      [...`${allCopy} ${rowsCopy}`.matchAll(/(\d+\.\d+\.\d+(?:-[\w.-]+)?)/g)].map((match) =>
        match[1].replace(/\.+$/, '')
      )
    );
    expect([...versionish], 'the only version named is the real npm one').toEqual(['0.1.0-next.1']);
    const shippedRow = content.statusRows.find((row) => row.id === 'web-runtime');
    expect(shippedRow?.kind).toBe('shipped');
    expect(shippedRow?.detail).toContain('0.1.0-next.1');
  });

  it('says the native renderer is in development and never published', () => {
    const renderer = content.statusRows.find((row) => row.id === 'native-renderer');
    expect(renderer?.kind).toBe('development');
    expect(renderer?.statusLabel).toMatch(/in development/i);
    expect(renderer?.detail).toMatch(/conformance-tested/i);
  });

  it('keeps Maven publication honest: planned, ADR-005, nothing on Maven', () => {
    const maven = content.statusRows.find((row) => row.id === 'maven-central');
    expect(maven?.kind).toBe('planned');
    expect(maven?.statusLabel).toMatch(/planned/i);
    expect(maven?.detail).toContain('ADR-005');
    expect(maven?.detail).toContain('com.texuli');
    expect(maven?.detail).toMatch(/nothing is on Maven yet/i);
  });

  it('never uses the banned phrases or presents a date as a promise', () => {
    const allCopy = JSON.stringify(content);
    expect(allCopy).not.toMatch(/coming soon/i);
    expect(allCopy).not.toMatch(/write once/i);
    expect(allCopy).not.toMatch(/production-ready native/i);
    expect(allCopy).not.toMatch(/\b20\d\d\b/);
    expect(allCopy).not.toMatch(/\bios\b/i);
  });
});

describe('native hero markup: headings and landmarks', () => {
  it('wires the section landmarks to the shared heading ids', () => {
    const source = componentSource();
    expect(source).toContain(`aria-labelledby={content.ids.hero}`);
    expect(source).toContain(`<h1 id={content.ids.hero}>`);
    expect(source).toContain(`aria-labelledby={content.ids.status}`);
    expect(source).toContain(`<h2 id={content.ids.status}>`);
    expect(content.ids.hero).toBe('native-hero-title');
    expect(content.ids.status).toBe('native-status-title');
  });

  it('renders exactly one h1 followed by the single status h2, in order', () => {
    const source = componentSource();
    const headings = [...source.matchAll(/<h([12])\b/g)].map((match) => match[1]);
    expect(headings, 'one h1 then one h2, nothing between or after').toEqual(['1', '2']);
    const h1 = source.indexOf('<h1');
    const lead = source.indexOf('native-hero__lead');
    const status = source.indexOf('<h2');
    expect(h1, 'eyebrow, h1, lead precede the status block').toBeGreaterThan(
      source.indexOf('native-hero__eyebrow')
    );
    expect(lead).toBeGreaterThan(h1);
    expect(status).toBeGreaterThan(lead);
  });

  it('renders the ledger from the module rows, term before detail', () => {
    const source = componentSource();
    expect(source).toContain('data-tx-status={row.kind}');
    expect(source).toContain('<dt>');
    expect(source.indexOf('<dt>')).toBeLessThan(source.indexOf('<dd>'));
  });
});

describe('native hero links: every href is a real route', () => {
  it('derives the site routes and finds the section targets among them', () => {
    const routes = deriveRoutes(PAGES_DIR);
    expect(routes).toContain('/native/');
    expect(routes).toContain('/web-and-native/');
    expect(routes).toContain('/guides/why-svelte-kotlin/');
    for (const link of content.links) {
      expect(routes, `${link.href} must be a shipped route`).toContain(link.href);
    }
  });

  it('links the deep-dive guide and keeps the architecture page reachable', () => {
    expect(content.links.map((link) => link.href)).toContain('/guides/why-svelte-kotlin/');
    expect(content.links.map((link) => link.href)).toContain('/web-and-native/');
  });

  it('resolves hrefs through withBase like the rest of the landing', () => {
    expect(componentSource()).toContain('href={withBase(base, link.href)}');
  });
});

describe('native hero planned markers', () => {
  it('marks exactly the planned rows, with the visible Planned text', () => {
    const source = componentSource();
    expect(source).toContain(`data-tx-planned={row.kind === 'planned' ? '' : undefined}`);
    for (const row of content.statusRows) {
      expect(row.statusLabel.startsWith('Planned')).toBe(row.kind === 'planned');
    }
    const plannedRows = content.statusRows.filter((row) => row.kind === 'planned');
    expect(plannedRows.length).toBeGreaterThan(0);
    for (const row of plannedRows) {
      expect(row.statusLabel).toContain('Planned');
    }
  });

  it('never marks shipped or development rows as planned', () => {
    for (const row of content.statusRows) {
      if (row.kind !== 'planned') {
        expect(row.statusLabel).not.toMatch(/planned/i);
        expect(row.detail).not.toMatch(/^planned/i);
      }
    }
  });
});

describe('native hero CSS: still, logical and token-driven', () => {
  it('adds no motion at all, so reduced-motion preferences need no exception', () => {
    const css = styleBlock();
    expect(css.match(/@keyframes|animation|transition/g) ?? []).toEqual([]);
  });

  it('uses logical properties only — no physical left/right/top/bottom CSS', () => {
    const css = styleBlock();
    const physical = css.match(
      /(?:margin|padding|inset|border)(?:-block|-inline)?-(?:left|right|top|bottom)\b|text-align:\s*(?:left|right)|float:|(?:^|\s)width:\s|(?:^|\s)height:\s/g
    );
    expect(physical ?? []).toEqual([]);
    expect(css).toMatch(/inline-size|padding-inline|padding-block|margin-inline|inset-inline/);
  });

  it('colors and radii come from the --tx-* token contract', () => {
    const css = styleBlock();
    expect(css).toContain('var(--tx-foreground)');
    expect(css).toContain('var(--tx-background)');
    expect(css).toContain('var(--tx-border)');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('is mobile-first: every media query widens, so 360px gets one column', () => {
    const css = styleBlock();
    const queries = css.match(/@media[^{]+/g) ?? [];
    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) {
      expect(query).toContain('min-width');
      expect(query).not.toContain('max-width');
    }
    expect(css).toMatch(/max-inline-size:/);
  });
});

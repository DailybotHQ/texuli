import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import {
  CATALOG_PAGE,
  catalogCards,
  filterCounts,
} from '../../src/components/solutions/catalog/catalog-content.ts';
import { platformRows } from '../../src/components/solutions/shared/platforms/platforms-model.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import type { SolutionEntry } from '../../src/data/solutions/schema.ts';
import { solutionsIndexDocument } from '../../src/lib/twins/solutions.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(WEBSITE, path), 'utf8');
const component = read('src/components/solutions/catalog/SolutionsCatalog.astro');
const content = read('src/components/solutions/catalog/catalog-content.ts');
const page = read('src/pages/solutions/index.astro');
const endpoint = read('src/pages/solutions/index.json.ts');
const markup = component.slice(component.lastIndexOf('---') + 3, component.indexOf('<style>'));
const styles = component.slice(component.indexOf('<style>'));

describe('/solutions/ catalog content', () => {
  it('renders every registry entry, in order, with its status and every platform badge', () => {
    const cards = catalogCards();
    expect(cards.map((c) => c.slug)).toEqual(SOLUTIONS.map((s) => s.slug));
    for (const [i, card] of cards.entries()) {
      const entry = SOLUTIONS[i] as SolutionEntry;
      expect(card.status).toBe(entry.status);
      expect(card.tagline).toBe(entry.tagline);
      expect(card.platforms).toEqual(platformRows(entry));
      expect(card.platforms.map((p) => p.platform)).toEqual(entry.platforms.map((p) => p.platform));
    }
  });

  it('never raises a native status: every card is native-planned today', () => {
    for (const card of catalogCards()) {
      expect(card.native, card.slug).toBe('planned');
      expect(card.onNative).toBe(false);
    }
    expect(filterCounts(catalogCards())).toEqual({
      all: SOLUTIONS.length,
      web: SOLUTIONS.length,
      native: 0,
    });
  });

  it('puts a Solution under Native only when an entry lists a native status past planned', () => {
    const base = SOLUTIONS[0] as SolutionEntry;
    const withDesktop: SolutionEntry = {
      ...base,
      platforms: [
        { platform: 'web', status: 'in development', evidence: [] },
        {
          platform: 'compose-desktop',
          status: 'experimental',
          evidence: ['native/docs/parity.json'],
        },
      ],
    };
    const [card] = catalogCards(() => false, [withDesktop]);
    expect(card?.native).toBe('experimental');
    expect(card?.onNative).toBe(true);
    expect(filterCounts([card as never]).native).toBe(1);
  });

  it('links a landing and docs only when the page exists, never the replaced demo page', () => {
    for (const card of catalogCards()) {
      const entry = SOLUTIONS.find((s) => s.slug === card.slug) as SolutionEntry;
      expect(card.landing).toBe(siteRouteExists(entry.route) ? entry.route : undefined);
      expect(card.docs).toBe(siteRouteExists(entry.docs) ? entry.docs : undefined);
      for (const href of [card.landing, card.docs]) if (href) expect(href).not.toMatch(/-page\/$/);
    }
    for (const card of catalogCards(() => false)) {
      expect(card.landing).toBeUndefined();
      expect(card.docs).toBeUndefined();
    }
    expect(siteRouteExists('/solutions/slides/')).toBe(true);
    expect(catalogCards().find((c) => c.slug === 'slides')?.landing).toBe('/solutions/slides/');
  });

  it('keeps the copy honest and free of plan ids, cloud or hosted promises', () => {
    const copy = JSON.stringify(CATALOG_PAGE);
    expect(copy).not.toMatch(/PLAN_|cloud|hosted|\bavailable\b/i);
    expect(CATALOG_PAGE.nativeEmpty).toMatch(/No Solution renders natively yet/);
    expect(content).not.toMatch(/import\.meta\.dirname|readFileSync|node:fs/);
  });
});

describe('/solutions/ filters without JavaScript', () => {
  it('offers All, Web and Native as in-page links to anchors placed before the filters and the list', () => {
    expect(markup).toContain('<span id={anchor(filter.id)} class="sol-catalog__anchor" />');
    expect(markup).toMatch(/href=\{`#\$\{anchor\(filter\.id\)\}`\}/);
    expect(markup.indexOf('sol-catalog__anchor')).toBeLessThan(
      markup.indexOf('sol-catalog__filters')
    );
    expect(markup.indexOf('sol-catalog__filters')).toBeLessThan(
      markup.indexOf('sol-catalog__cards')
    );
    expect(markup).toContain('aria-label={page.filters.label}');
  });

  it('hides off-filter cards and shows the native note with CSS :target only', () => {
    expect(styles).toMatch(/#solutions-web:target ~ \.sol-catalog__cards \[data-on-web='false'\]/);
    expect(styles).toMatch(
      /#solutions-native:target ~ \.sol-catalog__cards \[data-on-native='false'\]/
    );
    expect(styles).toMatch(
      /#solutions-native:target ~ \.sol-catalog__native-empty \{\s*display: block;/
    );
    expect(markup).toContain('data-on-web={String(card.onWeb)}');
    expect(markup).toContain('data-on-native={String(card.onNative)}');
  });

  it('ships no script and no island', () => {
    for (const source of [markup, page]) expect(source).not.toMatch(/client:[a-z]+/);
    expect(component).not.toMatch(/<script\b|set:html|\{@html|innerHTML/);
    expect(page).not.toMatch(/<script\b/);
  });
});

describe('/solutions/ page and markup', () => {
  it('is a landing page on BaseLayout and its route exists', () => {
    expect(page).toContain(
      '<BaseLayout title={CATALOG_PAGE.title} description={CATALOG_PAGE.description} landing>'
    );
    expect(page).toContain('<SolutionsCatalog />');
    expect(siteRouteExists('/solutions/')).toBe(true);
  });

  it('has one h1, one h2 per card, status badges per Solution and platform, URL-policy links', () => {
    expect((markup.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(markup).toContain('<h2>{card.name}</h2>');
    expect(markup).toContain('<StatusBadge status={card.status} context={card.name} />');
    expect(markup).toContain('<StatusBadge status={row.badge.status} context={row.name} />');
    expect(markup).toContain('href={resolveHref(card.landing)}');
    expect(markup).toContain('href={resolveHref(card.docs)}');
    expect(component).toContain("safeHref(href, 'developer')");
    expect(markup).not.toMatch(/\sstyle=/);
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });

  it('uses the page-solutions art when registered, else a decorative mosaic', () => {
    expect(CATALOG_PAGE.hero.art).toBe('page-solutions');
    expect(markup).toContain('<SiteIllustration art={page.hero.art} />');
    expect(markup).toMatch(/class="sol-catalog__mosaic" aria-hidden="true"/);
  });
});

describe('/solutions/index.json', () => {
  it('is a static endpoint over solutionsIndexDocument(SITE_URL)', () => {
    expect(endpoint).toContain('solutionsIndexDocument(SITE_URL)');
    expect(endpoint).toContain("import { SITE_URL } from '../../lib/constances';");
    expect(endpoint).toContain("'content-type': 'application/json; charset=utf-8'");
    expect(endpoint).not.toMatch(/import\.meta\.dirname|readFileSync|node:fs/);
  });

  it('lists the catalog and every Solution whose landing exists', () => {
    const doc = solutionsIndexDocument('https://texuli.com');
    expect(doc.catalog).toBe('https://texuli.com/solutions/');
    expect(doc.solutions.map((s) => s.slug)).toEqual(
      SOLUTIONS.filter((s) => siteRouteExists(s.route)).map((s) => s.slug)
    );
  });
});

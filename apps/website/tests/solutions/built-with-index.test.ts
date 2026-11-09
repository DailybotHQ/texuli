import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUILT_WITH_PAGE,
  builtWithGroups,
  caseStudyRoute,
  productCard,
} from '../../src/components/built-with/index/index-content.ts';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import {
  LISTED_PRODUCTS,
  PRODUCTS,
  PROTOYARD,
  type ProductEntry,
  RONIN_BUILDER,
} from '../../src/data/products/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(WEBSITE, path), 'utf8');
const component = read('src/components/built-with/index/BuiltWithIndex.astro');
const page = read('src/pages/built-with/index.astro');
const markup = component.slice(component.lastIndexOf('---') + 3, component.indexOf('<style>'));
const styles = component.slice(component.indexOf('<style>'));

describe('/built-with/ data', () => {
  it('renders listed products only, grouped owner then community', () => {
    const groups = builtWithGroups();
    expect(groups.map((g) => g.group)).toEqual(['owner', 'community']);
    const ids = groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids).toEqual(LISTED_PRODUCTS.map((p) => p.id));
    expect(ids).not.toContain(RONIN_BUILDER.id);
    for (const product of PRODUCTS.filter((p) => p.visibility === 'unlisted'))
      expect(ids).not.toContain(product.id);
    const unlisted = builtWithGroups([{ ...PROTOYARD, visibility: 'unlisted' }]);
    expect(unlisted.flatMap((g) => g.cards)).toEqual([]);
  });

  it('copies status and offerings from the record, so Protoyard Cloud stays planned', () => {
    const card = productCard(PROTOYARD);
    expect(card.status).toBe(PROTOYARD.status);
    expect(card.offerings).toEqual(
      PROTOYARD.offerings.map((o) => ({ label: o.label, status: o.status }))
    );
    expect(card.offerings.find((o) => o.label === 'Protoyard Cloud')?.status).toBe('planned');
  });

  it('links the product domain through the URL policy, and nothing for a product without one', () => {
    expect(productCard(PROTOYARD).site).toEqual({
      href: 'https://protoyard.app',
      label: 'protoyard.app',
    });
    const noDomain: ProductEntry = { ...PROTOYARD, domain: null };
    expect(productCard(noDomain).site).toBeUndefined();
  });

  it('links a case study only when its page exists', () => {
    expect(caseStudyRoute(PROTOYARD)).toBe('/built-with/protoyard/');
    expect(siteRouteExists('/built-with/protoyard/')).toBe(true);
    expect(productCard(PROTOYARD).caseStudy).toBe('/built-with/protoyard/');
    expect(productCard(PROTOYARD, () => false).caseStudy).toBeUndefined();
    for (const { cards } of builtWithGroups())
      for (const card of cards)
        if (card.caseStudy) expect(siteRouteExists(card.caseStudy)).toBe(true);
  });

  it('states the brand rule in the intro and names no plan or unlisted product', () => {
    expect(BUILT_WITH_PAGE.hero.lede).toMatch(/keep their own brand and domain/);
    const copy = JSON.stringify(BUILT_WITH_PAGE);
    expect(copy).not.toMatch(/PLAN_|Ronin|cloud/i);
  });
});

describe('/built-with/ page and markup', () => {
  it('is a landing page on BaseLayout and exists as a route', () => {
    expect(page).toContain(
      '<BaseLayout title={BUILT_WITH_PAGE.title} description={BUILT_WITH_PAGE.description} landing>'
    );
    expect(page).toContain('<BuiltWithIndex />');
    expect(siteRouteExists('/built-with/')).toBe(true);
  });

  it('has one h1, an h2 per group, an h3 per card and status badges for products and offerings', () => {
    expect((markup.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(markup).toContain('<h2 id={meta.id}>{meta.title}</h2>');
    expect(markup).toContain('<h3>{card.name}</h3>');
    expect(markup).toContain('<StatusBadge status={card.status} context={card.name} />');
    expect(markup).toContain('<StatusBadge status={offering.status} context={offering.label} />');
    expect(markup).toContain('{meta.empty}');
  });

  it('is static and safe: no island, sink or inline style, a decorative mosaic, logical CSS', () => {
    expect(markup).toMatch(/class="built-with__mosaic" aria-hidden="true"/);
    expect(markup).not.toMatch(/<img\b/);
    for (const source of [markup, page]) expect(source).not.toMatch(/client:[a-z]+/);
    expect(component).not.toMatch(/<script\b|set:html|\{@html|innerHTML/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(markup).toContain('href={resolveHref(card.caseStudy)}');
    expect(markup).toContain('href={card.site.href} rel="noopener"');
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});

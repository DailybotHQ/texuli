import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import {
  HOME_BUILT_WITH_COPY,
  homeBuiltWithCards,
  homeBuiltWithIndex,
} from '../../src/components/sections/home/built-with/built-with-content.ts';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import { LISTED_PRODUCTS, PROTOYARD, RONIN_BUILDER } from '../../src/data/products/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const DIR = resolve(WEBSITE, 'src/components/sections/home/built-with');
const component = readFileSync(resolve(DIR, 'HomeBuiltWith.astro'), 'utf8');
const content = readFileSync(resolve(DIR, 'built-with-content.ts'), 'utf8');
const markup = component.slice(component.lastIndexOf('---') + 3, component.indexOf('<style>'));
const styles = component.slice(component.indexOf('<style>'));

describe('home Built with Texuli band content', () => {
  it('uses the storyboard title, a short body and states the brand rule', () => {
    expect(HOME_BUILT_WITH_COPY.title).toBe('The foundation behind real products.');
    expect(wordCount(HOME_BUILT_WITH_COPY.body)).toBeLessThanOrEqual(40);
    expect(HOME_BUILT_WITH_COPY.body).toMatch(/keep their own brand and domain/);
    expect(JSON.stringify(HOME_BUILT_WITH_COPY)).not.toMatch(/PLAN_|Ronin/);
  });

  it('shows listed products only (Protoyard), with the record status', () => {
    const cards = homeBuiltWithCards();
    expect(cards.map((c) => c.id)).toEqual(LISTED_PRODUCTS.map((p) => p.id));
    expect(cards.map((c) => c.id)).not.toContain(RONIN_BUILDER.id);
    expect(cards[0]?.status).toBe(PROTOYARD.status);
  });

  it('labels every non-available offering as roadmap, so Protoyard Cloud is never under Today', () => {
    const [protoyard] = homeBuiltWithCards();
    expect(protoyard?.today.map((o) => o.label)).toEqual(['Open-source local']);
    expect(protoyard?.roadmap).toEqual([{ label: 'Protoyard Cloud', status: 'planned' }]);
    for (const card of homeBuiltWithCards()) {
      for (const offer of card.today) expect(offer.status).toBe('available');
      for (const offer of card.roadmap) expect(offer.status).not.toBe('available');
    }
  });

  it('links /built-with/ and the Protoyard case study, which exist, and nothing without a page', () => {
    expect(siteRouteExists('/built-with/')).toBe(true);
    expect(siteRouteExists('/built-with/protoyard/')).toBe(true);
    expect(homeBuiltWithIndex()?.href).toBe('/built-with/');
    expect(homeBuiltWithCards()[0]?.caseStudy).toBe('/built-with/protoyard/');
    expect(homeBuiltWithIndex(() => false)).toBeUndefined();
    expect(homeBuiltWithCards(LISTED_PRODUCTS, () => false)[0]?.caseStudy).toBeUndefined();
    expect(homeBuiltWithCards()[0]?.site).toEqual({
      href: 'https://protoyard.app',
      label: 'protoyard.app',
    });
  });

  it('reads no file at runtime, so it survives bundling', () => {
    expect(content).not.toMatch(/import\.meta\.dirname|readFileSync|node:fs/);
    expect(component).not.toMatch(/import\.meta\.dirname|readFileSync|node:fs/);
  });
});

describe('home Built with Texuli band markup', () => {
  it('is a labelled section with one h2, card h3s, Today and Roadmap labels and badges', () => {
    expect(markup).toContain('aria-labelledby={copy.id}');
    expect((markup.match(/<h2\b/g) ?? []).length).toBe(1);
    expect((markup.match(/<h3\b/g) ?? []).length).toBe(1);
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup).toContain('{copy.today}');
    expect(markup).toContain('{copy.roadmap}');
    expect(markup).toContain('data-offers="roadmap"');
    expect(markup).toContain('<StatusBadge status={offer.status} context={offer.label} />');
  });

  it('uses the home-built-with art when registered, else a decorative mosaic', () => {
    expect(HOME_BUILT_WITH_COPY.art).toBe('home-built-with');
    expect(markup).toContain('<SiteIllustration art={copy.art} />');
    expect(markup).toMatch(/class="home-built-with__mosaic" aria-hidden="true"/);
  });

  it('is static and safe, with URL-policy links and logical CSS', () => {
    expect(markup).not.toMatch(/client:[a-z]+/);
    expect(component).not.toMatch(/<script\b|set:html|\{@html|innerHTML/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(markup).toContain('href={resolveHref(card.caseStudy)}');
    expect(markup).toContain('href={resolveHref(index.href)}');
    expect(markup).toContain('href={card.site.href} rel="noopener"');
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});

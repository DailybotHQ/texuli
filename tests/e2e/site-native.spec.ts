/// <reference types="node" />
/**
 * /native/ — the native-focused landing (G7, T-45..T-48). The page is
 * assembled (T-48) from the three committed sections in
 * `apps/website/src/components/sections/native/`, so every T-33 skeleton
 * placeholder is a real assertion now: metadata, hero + status honesty, the
 * why-KMP runtime story, the spec-seam evidence and roadmap, section order,
 * the heading ladder and IA reachability — all read from the built HTML.
 * Reads the built site (`pnpm build` first); no server needed. The
 * framework-level sweeps stay where they live: axe in `a11y-site.spec.ts`
 * (every built page), the header click-through in `site-ia.spec.ts`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const DIST = resolve('apps/website/dist');

const nativeHtml = () => readFileSync(join(DIST, 'native', 'index.html'), 'utf8');

/**
 * The page's main content only: head chrome, header and footer stay out of
 * the content assertions, so a nav or footer change cannot mask a section
 * regression (and the heading ladder below is the page's own).
 */
function mainSlice(html: string): string {
  const start = html.indexOf('<main');
  const end = html.indexOf('</main>');
  expect(start, 'the built page has a <main> element').toBeGreaterThanOrEqual(0);
  expect(end, 'the built page closes </main>').toBeGreaterThan(start);
  return html.slice(start, end);
}

test.describe('native metadata (shipped by the T-31 scaffold)', () => {
  test.skip(!existsSync(join(DIST, 'native', 'index.html')), 'run `pnpm build` first');

  test('the title and description follow the T-17 contract', () => {
    const html = nativeHtml();
    expect(html).toContain(
      '<title>Texuli native — the same catalog, rendered by Compose · Texuli</title>'
    );
    expect(html).toMatch(/name="description" content="[^"]*in development[^"]*"/i);
    expect(html).toContain('rel="canonical" href="https://texuli.com/native/"');
  });

  test('the JSON-LD is Organization-only: nothing installable, no SoftwareApplication', () => {
    const html = nativeHtml();
    expect(html).toContain('"@type":"Organization"');
    expect(html).not.toContain('"SoftwareApplication"');
  });

  test('the Open Graph set names the page and its canonical URL', () => {
    const html = nativeHtml();
    expect(html).toContain('<meta property="og:url" content="https://texuli.com/native/">');
    expect(html).toContain(
      '<meta property="og:title" content="Texuli native — the same catalog, rendered by Compose · Texuli">'
    );
    expect(html).toContain('<meta property="og:site_name" content="Texuli">');
  });
});

test.describe('native honest status (shipped by the T-31 scaffold)', () => {
  test.skip(!existsSync(join(DIST, 'native', 'index.html')), 'run `pnpm build` first');

  test('the page names the renderer in development and never promises a date', () => {
    const html = nativeHtml();
    expect(html).toContain('in development');
    expect(html).toMatch(/Compose/);
    expect(html).toMatch(/Kotlin Multiplatform/);
    expect(html).not.toMatch(/coming soon/i);
  });

  test('the architecture page is linked', () => {
    expect(nativeHtml()).toContain('href="/web-and-native/"');
  });
});

test.describe('native hero (T-45)', () => {
  test.skip(!existsSync(join(DIST, 'native', 'index.html')), 'run `pnpm build` first');

  test('the hero states the one-contract claim and keeps the only h1 on the page', () => {
    const main = mainSlice(nativeHtml());
    expect(main).toContain('data-tx-native-hero');
    expect(main).toContain('aria-labelledby="native-hero-title"');
    // The T-31 scaffold slot is retired; the section component owns the hero.
    expect(main).not.toContain('data-tx-native-slot');
    // Exactly one h1, it is the hero's, and the copy contract holds.
    expect((main.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    const h1At = main.indexOf('<h1 id="native-hero-title"');
    expect(h1At).toBeGreaterThanOrEqual(0);
    const titleAt = main.indexOf('The same catalog, rendered by Compose.');
    expect(titleAt, 'the h1 carries the one-contract claim').toBeGreaterThan(h1At);
    expect(main.indexOf('</h1>')).toBeGreaterThan(titleAt);
    expect(main).toContain('in development');
    // The primary call to action leads to the deep-dive guide.
    expect(main).toContain('href="/guides/why-svelte-kotlin/"');
  });

  test('the status ledger separates shipped, in-development and planned states', () => {
    const main = mainSlice(nativeHtml());
    expect(main).toContain('aria-labelledby="native-status-title"');
    expect(main).toMatch(/<h2 id="native-status-title"[^>]*>What exists today<\/h2>/);
    for (const kind of ['shipped', 'development', 'planned'] as const) {
      expect(main).toContain(`data-tx-status-badge="${kind}"`);
    }
    // The planned marker renders, and only planned rows carry it.
    expect(main).toContain('data-tx-planned');
    expect(main).toContain('data-tx-status="planned"');
    // The claims match reality: the real npm version, ADR-005, no Maven.
    expect(main).toContain('0.1.0-next.3');
    expect(main).toContain('Planned (ADR-005)');
    expect(main).toContain('nothing is on Maven yet');
    expect(main).toContain('conformance-tested');
  });
});

test.describe('native runtime story (T-46)', () => {
  test.skip(!existsSync(join(DIST, 'native', 'index.html')), 'run `pnpm build` first');

  test('the KMP renderer story renders with honest maturity labels and verbatim proof', () => {
    const main = mainSlice(nativeHtml());
    expect(main).toContain('data-tx-native-section="why-kmp"');
    expect(main).toContain('aria-labelledby="native-why-kmp-title"');
    expect(main).toMatch(/<h2 id="native-why-kmp-title"[^>]*>Why Kotlin Multiplatform<\/h2>/);
    // The honest status, word for word as the unit-tested content module states it.
    expect(main).toContain('in development');
    expect(main).toContain('conformance-tested');
    expect(main).toContain('Nothing is published to Maven Central yet');
    // The proof is verbatim repository Kotlin: named, scrollable code regions.
    expect(main).toContain('role="region"');
    expect(main).toContain('tabindex="0"');
    expect(main).toContain('aria-label="Kotlin source excerpt from');
    expect(main).toContain('enum class BindingStatus { IMPLEMENTED, PLACEHOLDER }');
    expect(main).toContain('BlueprintView.kt</code>');
    // Depth links: the guide and the architecture page.
    expect(main).toContain('href="/guides/why-svelte-kotlin/"');
    expect(main).toContain('href="/web-and-native/"');
  });
});

test.describe('native evidence: the spec seam and the roadmap (T-47)', () => {
  test.skip(!existsSync(join(DIST, 'native', 'index.html')), 'run `pnpm build` first');

  test('the spec seam renders the TS + Kotlin projection story', () => {
    const main = mainSlice(nativeHtml());
    // The status ledger names the one-manifest mechanism and both projections.
    expect(main).toContain('One manifest projects both ways today');
    expect(main).toContain('packages/spec/generated/kotlin/');
    // The evidence section shows the native modules at their repo paths.
    expect(main).toContain('data-tx-native-evidence');
    expect(main).toMatch(
      /<h2 id="native-evidence-title"[^>]*>What exists in this repository today<\/h2>/
    );
    expect(main).toMatch(/native\/texuli-spec<\/code>/);
    expect(main).toMatch(/native\/texuli-compose<\/code>/);
    // Paths render as text, never as links: the site does not mirror files.
    expect(main).not.toMatch(/<a[^>]*href="native\//);
  });

  test('the roadmap separates what ships from what is planned', () => {
    const main = mainSlice(nativeHtml());
    expect((main.match(/<li data-status="shipped"[\s>]/g) ?? []).length).toBeGreaterThan(0);
    expect((main.match(/<li data-status="planned"[\s>]/g) ?? []).length).toBeGreaterThan(0);
    // The visible Planned heading is the site's planned-marker convention.
    expect(main).toMatch(/<h3 id="native-planned-title"[^>]*>Planned<\/h3>/);
    expect(main).toContain('Planned is not promised');
    expect(main).toContain('nothing is on Maven Central yet');
  });
});

test.describe('native integration: order, honesty and reachability (T-48)', () => {
  test.skip(!existsSync(join(DIST, 'native', 'index.html')), 'run `pnpm build` first');

  test('the three sections mount in blueprint order with an unbroken heading ladder', () => {
    const main = mainSlice(nativeHtml());
    const heroAt = main.indexOf('data-tx-native-hero');
    const whyAt = main.indexOf('data-tx-native-section="why-kmp"');
    const evidenceAt = main.indexOf('data-tx-native-evidence');
    expect(heroAt).toBeGreaterThanOrEqual(0);
    expect(whyAt, 'the why-KMP section follows the hero').toBeGreaterThan(heroAt);
    expect(evidenceAt, 'the evidence section comes last').toBeGreaterThan(whyAt);
    // h1 (hero) → h2 (status) → h2 + 2×h3 (why-KMP) → h2 + 3×h3 (evidence):
    // no skipped levels, exactly one h1, nothing the sections do not own.
    const ladder = [...main.matchAll(/<h([1-6])[\s>]/g)].map((match) => match[1]);
    expect(ladder).toEqual(['1', '2', '2', '3', '3', '2', '3', '3', '3']);
  });

  test('the page copy stays inside the honesty ban list', () => {
    const html = nativeHtml();
    expect(html).not.toMatch(/coming soon/i);
    expect(html).not.toMatch(/write once/i);
    expect(html).not.toMatch(/production-ready native/i);
    const main = mainSlice(html);
    // No calendar year in the page content: dates are never promises here.
    expect(main).not.toMatch(/\b20\d\d\b/);
    expect(main).toMatch(/\bin development\b/);
  });

  test('the landing is reachable per the IA: one header link from home, links resolve', () => {
    // The home header carries the platform door to /native/ (site-ia clicks
    // it through); the page ships alongside it in the built site.
    const home = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(home).toContain('href="/native/"');
    const html = nativeHtml();
    expect(html).toContain('href="/native/"');
    expect(html).toContain('href="/web-and-native/"');
    // Every link the page content ships resolves to a built route.
    const main = mainSlice(html);
    const hrefs = [...main.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const route = href.replace(/[?#].*$/, '');
      expect(
        existsSync(join(DIST, route, 'index.html')) || existsSync(`${join(DIST, route)}.html`),
        `unresolved content link: ${href}`
      ).toBe(true);
    }
  });
});

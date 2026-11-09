import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import {
  WEB_NATIVE_COPY,
  webNativeActions,
  webNativeCards,
} from '../../src/components/sections/home/web-native/web-native-content.ts';
import { NATIVE_COMPATIBILITY } from '../../src/data/native/compatibility.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const source = readFileSync(
  resolve(WEBSITE, 'src/components/sections/home/web-native/HomeWebNative.astro'),
  'utf8'
);
const markup = source.slice(source.lastIndexOf('---') + 3, source.indexOf('<style>'));
const styles = source.slice(source.indexOf('<style>'));
const content = readFileSync(
  resolve(WEBSITE, 'src/components/sections/home/web-native/web-native-content.ts'),
  'utf8'
);
const parity = JSON.parse(readFileSync(resolve(REPO, 'native/docs/parity.json'), 'utf8')) as {
  totals: { catalog: number; painted: number; readOnly: number };
};

describe('Web & Native band copy', () => {
  it('uses the vision copy within the home budgets, with the status line and the plate', () => {
    expect(WEB_NATIVE_COPY.eyebrow).toBe('One foundation, multiple platforms');
    expect(WEB_NATIVE_COPY.title).toBe('Your interfaces shouldn’t stop at the browser.');
    expect(wordCount(WEB_NATIVE_COPY.body)).toBeLessThanOrEqual(40);
    expect(WEB_NATIVE_COPY.status).toBe('Native is under active development.');
    expect(illustrationFor(WEB_NATIVE_COPY.art)?.variant).toBe('plate');
    expect(JSON.stringify(WEB_NATIVE_COPY)).not.toMatch(/PLAN_|Build once|Run anywhere|cloud/i);
  });

  it('leads with the /native/ call to action and links only existing routes', () => {
    const actions = webNativeActions();
    expect(actions[0]).toEqual({
      label: 'Explore Texuli Native',
      href: '/native/',
      role: 'primary',
    });
    for (const action of actions) expect(siteRouteExists(action.href), action.href).toBe(true);
    expect(webNativeActions(() => false)).toEqual([]);
  });
});

describe('Web & Native cards', () => {
  it('shows web available, the Compose Desktop slice in development and Android and iOS planned', () => {
    const cards = webNativeCards();
    expect(cards.map((c) => [c.id, c.status])).toEqual([
      ['web', 'available'],
      ['compose-desktop', 'in development'],
      ['mobile', 'planned'],
    ]);
  });

  it('takes its counts from the generated compatibility data, equal to native/docs/parity.json', () => {
    const desktop = webNativeCards()[1];
    expect(NATIVE_COMPATIBILITY.totals.painted).toBe(parity.totals.painted);
    expect(desktop?.body).toContain(
      `${parity.totals.painted} of ${parity.totals.catalog} catalog components`
    );
    expect(desktop?.body).toContain(`${parity.totals.readOnly} of them read-only`);
    expect(content).not.toMatch(/\b(52|170|118)\b/);
  });

  it('follows the compatibility data when a mobile renderer appears, and never claims more than experimental', () => {
    const changed = {
      ...NATIVE_COMPATIBILITY,
      platforms: NATIVE_COMPATIBILITY.platforms.map((p) =>
        p.target === 'Android UI renderer' ? { ...p, status: 'Experimental' as const } : p
      ),
    };
    const mobile = webNativeCards(changed)[2];
    expect(mobile?.status).toBe('experimental');
    expect(mobile?.body).toMatch(/device readiness is not implied/);
    const allSupported = {
      ...NATIVE_COMPATIBILITY,
      platforms: NATIVE_COMPATIBILITY.platforms.map((p) => ({
        ...p,
        status: 'Supported' as const,
      })),
    };
    for (const card of webNativeCards(allSupported).slice(1))
      expect(['in development', 'experimental', 'planned']).toContain(card.status);
  });
});

describe('Web & Native markup', () => {
  it('is a labelled section with one h2, card h3s, shared badges and the plate', () => {
    expect(markup).toContain('aria-labelledby={copy.id}');
    expect((markup.match(/<h2\b/g) ?? []).length).toBe(1);
    expect((markup.match(/<h3\b/g) ?? []).length).toBe(1);
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup).toContain('<StatusBadge status={card.status} context={card.title} />');
    expect(markup).toContain('<SiteIllustration art={copy.art} />');
  });

  it('is static and safe: no island, no fake switch, URL-policy links, logical CSS', () => {
    expect(markup).not.toMatch(/client:[a-z]+/);
    expect(source).not.toMatch(/<script\b|set:html|\{@html|innerHTML/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(markup).not.toMatch(/role="(tab|switch|tablist)"|<button\b|<input\b/);
    expect(source).toContain("safeHref(href, 'developer')");
    for (const href of markup.match(/href=\{[^}]+\}/g) ?? [])
      expect(href).toMatch(/^href=\{resolveHref\(/);
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});

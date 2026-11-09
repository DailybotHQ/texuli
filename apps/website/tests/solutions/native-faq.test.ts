import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_URL } from '../../src/components/foundation/site.ts';
import {
  NATIVE_FAQ,
  nativeFaqItems,
} from '../../src/components/sections/native/faq/faq-content.ts';
import { NATIVE_COMPATIBILITY } from '../../src/data/native/compatibility.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const COMPONENT = readFileSync(
  resolve(WEBSITE, 'src/components/sections/native/faq/NativeFaq.astro'),
  'utf8'
);
const items = nativeFaqItems();
const byId = Object.fromEntries(items.map((item) => [item.id, item]));
const parity = JSON.parse(readFileSync(resolve(REPO, 'native/docs/parity.json'), 'utf8')) as {
  totals: { catalog: number; painted: number };
};

describe('Native FAQ', () => {
  it('asks every §50.4 question plus availability, with honest answers', () => {
    expect(items.map((item) => item.question)).toEqual([
      'Is native available?',
      'Is this React Native?',
      'Does Texuli Native reuse Svelte components?',
      'Is it a WebView?',
      'Can I use it in iOS today?',
      'Can I use it in Android today?',
      'Are all Web components available natively?',
      'How are accessibility and native navigation handled?',
      'Can agents generate interfaces for both?',
      'How do blueprints travel?',
      'Where can I see compatibility and limitations?',
      'How do I try it?',
      'How do I contribute?',
    ]);
    expect(byId.available?.answer).toMatch(/^No\./);
    expect(byId.available?.answer).toMatch(/read-only slice/);
    expect(byId['react-native']?.answer).toMatch(/^No\./);
    expect(byId.svelte?.answer).toMatch(/^No\./);
    expect(byId.webview?.answer).toMatch(/^No\./);
    expect(byId.ios?.answer).toMatch(/^No\./);
    expect(byId.android?.answer).toMatch(/^No\./);
    expect(byId['all-components']?.answer).toMatch(/^No\./);
    const copy = JSON.stringify(items);
    expect(copy).not.toMatch(/production[- ]ready|write once|run anywhere|coming soon/i);
    expect(copy).not.toMatch(/PLAN_|React Native app|WebView wrapper/i);
  });

  it('takes catalog counts only from the compatibility data', () => {
    expect(NATIVE_COMPATIBILITY.totals).toMatchObject(parity.totals);
    const slice = `${parity.totals.painted} of ${parity.totals.catalog}`;
    expect(byId.available?.answer).toContain(slice);
    expect(byId['all-components']?.answer).toContain(slice);
    expect(byId.try?.answer).toContain(NATIVE_FAQ.tryCommand);
    expect(byId.try?.answer).toContain(NATIVE_FAQ.jdk);
    expect(NATIVE_FAQ.tryCommand).toBe('./native/gradlew -p native check');
    expect(NATIVE_FAQ.jdk).toBe('JDK 21');
  });

  it('points every FAQ link at a real page or the native directory', () => {
    for (const item of items) {
      for (const link of item.links ?? []) {
        if (link.href.startsWith(REPOSITORY_URL)) {
          expect(link.href).toBe(`${REPOSITORY_URL}/tree/main/native`);
          expect(existsSync(resolve(REPO, 'native/README.md'))).toBe(true);
          continue;
        }
        const [path, hash] = link.href.split('#');
        expect(path).not.toMatch(/-page\//);
        const page = resolve(
          WEBSITE,
          'src/pages',
          (path ?? '').replace(/^\/+|\/+$/g, ''),
          'index.astro'
        );
        expect(existsSync(page), link.href).toBe(true);
        if (hash) expect(readFileSync(page, 'utf8')).toContain(`id="${hash}"`);
      }
    }
  });

  it('is a static details/summary list with no script or HTML sink', () => {
    expect(COMPONENT).toContain('<details');
    expect(COMPONENT).toContain('<summary>');
    expect(COMPONENT).not.toMatch(/client:|set:html|\{@html|innerHTML|<script/);
    expect(COMPONENT).toContain("safeHref(link.href, 'developer')");
    expect(COMPONENT).toContain('aria-labelledby={NATIVE_FAQ.ids.heading}');
    expect(COMPONENT).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});

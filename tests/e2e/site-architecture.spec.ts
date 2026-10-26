/// <reference types="node" />
/**
 * /web-and-native/ — the architecture and correlation page (G8,
 * T-49..T-52). Skeleton: the scaffold's shipped behavior is asserted for
 * real (docs-shell membership, metadata, cross-links), and every coming
 * section assertion is a `test.fixme` placeholder the G8 tasks turn green
 * at integration. Reads the built site (`pnpm build` first).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const DIST = resolve('apps/website/dist');

const pageHtml = () => readFileSync(join(DIST, 'web-and-native', 'index.html'), 'utf8');

test.describe('architecture metadata and shell (shipped by T-31/T-32)', () => {
  test.skip(!existsSync(join(DIST, 'web-and-native', 'index.html')), 'run `pnpm build` first');

  test('the title and description follow the T-17 contract', () => {
    const html = pageHtml();
    expect(html).toContain(
      '<title>Web and native, one contract — Texuli&#39;s architecture · Texuli</title>'
    );
    expect(html).toContain('rel="canonical" href="https://texuli.com/web-and-native/"');
  });

  test('the page lives in the docs shell: docs header, sidebar, menu', () => {
    const html = pageHtml();
    const header = html.match(/<header class="site-header"[\s\S]*?<\/header>/)?.[0] ?? '';
    expect(html).toContain('data-tx-site-sidebar');
    expect(header).toContain('data-variant="docs"');
    expect(header).toContain('data-site-menu');
  });

  test('the cross-link rule holds: native landing and the deep-dive guide linked', () => {
    const html = pageHtml();
    expect(html).toContain('href="/native/"');
    expect(html).toContain('href="/guides/why-svelte-kotlin/"');
  });
});

test.describe('architecture why-both section (T-49)', () => {
  test.fixme('the section explains why Svelte for the web and Kotlin for native', async () => {
    // T-49: why-both section; assertions to grow here: two-technology
    // framing, no framework-vs-framework detours, phone fit.
  });
});

test.describe('architecture one-contract section (T-50)', () => {
  test.fixme('the spec manifest and its TS + Kotlin projections render end to end', async () => {
    // T-50: one-contract section; assertions to grow here: one manifest →
    // two projections mechanism, the seam named, code or diagram present.
  });
});

test.describe('architecture portability section (T-51)', () => {
  test.fixme('interface portability is defined with a concrete move story', async () => {
    // T-51: portability section; assertions to grow here: what moving an
    // interface between runtimes takes, honest caveats where it does not.
  });
});

test.describe('architecture status and integration (T-52)', () => {
  test.fixme('the status block is honest and the TechArticle graph ships', async () => {
    // T-52: status + final integration; assertions to grow here: what
    // exists today (web shipped, native in development), the TechArticle
    // JSON-LD per the T-17 table, full-page axe pass, pager and TOC.
  });
});

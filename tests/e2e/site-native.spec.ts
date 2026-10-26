/// <reference types="node" />
/**
 * /native/ — the native-focused landing (G7, T-45..T-48). Skeleton: the
 * scaffold's shipped behavior is asserted for real (metadata, honest
 * status, cross-links), and every coming section assertion is a
 * `test.fixme` placeholder the G7 tasks turn green at integration.
 * Reads the built site (`pnpm build` first); no server needed yet.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const DIST = resolve('apps/website/dist');

const nativeHtml = () => readFileSync(join(DIST, 'native', 'index.html'), 'utf8');

test.describe('native metadata (shipped by the T-31 scaffold)', () => {
  test.skip(!existsSync(join(DIST, 'native', 'index.html')), 'run `pnpm build` first');

  test('the title and description follow the T-17 contract', () => {
    const html = nativeHtml();
    expect(html).toContain('<title>Texuli native — the same catalog, rendered by Compose · Texuli</title>');
    expect(html).toMatch(/name="description" content="[^"]*in development[^"]*"/i);
    expect(html).toContain('rel="canonical" href="https://texuli.com/native/"');
  });

  test('the JSON-LD is Organization-only: nothing installable, no SoftwareApplication', () => {
    const html = nativeHtml();
    expect(html).toContain('"@type":"Organization"');
    expect(html).not.toContain('"SoftwareApplication"');
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
  test.fixme('the hero states the one-contract claim with the platform proof strip', async () => {
    // T-45: hero section component with the live proof strip; assertions to
    // grow here: h1 text contract, proof-strip widget states, CTA targets.
  });
});

test.describe('native runtime story (T-46)', () => {
  test.fixme('the KMP renderer story renders with honest maturity labels', async () => {
    // T-46: runtime story section; assertions to grow here: section order,
    // the conformance-tested claim carries its evidence link, RTL mode.
  });
});

test.describe('native spec-contract mechanism (T-47)', () => {
  test.fixme('the spec seam renders the TS + Kotlin projection story', async () => {
    // T-47: spec-contract section; assertions to grow here: manifest → two
    // projections diagram/code, link to /web-and-native/#one-contract.
  });
});

test.describe('native status and roadmap (T-48)', () => {
  test.fixme('the status block separates what ships from what is planned', async () => {
    // T-48: status + roadmap integration; assertions to grow here: shipped
    // vs planned lists, roadmap granularity from native/README.md, no dates
    // presented as promises, full-page axe pass, phone fit.
  });
});

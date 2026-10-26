/**
 * UmamiLoader.astro structural units (T-34). The root vitest config does
 * not compile .astro files (owner-held), so the component's rendered
 * behavior is proven by the built-site spec in T-39; these tests pin the
 * safety-critical shape: the enabled gate in front of the script tag, the
 * same-origin loader file, and the data attributes the loader reads.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const COMPONENT = resolve('apps/website/src/components/analytics/UmamiLoader.astro');

describe('UmamiLoader.astro', () => {
  const source = readFileSync(COMPONENT, 'utf8');

  it('gates the script tag on the analytics enabled flag', () => {
    expect(source).toContain('umami.enabled &&');
    expect(source).toMatch(/<script[^>]*is:inline/s);
  });

  it('mounts the same-origin loader with the attributes it reads', () => {
    expect(source).toContain('src="/umami-loader.js"');
    expect(source).toContain('data-umami-loader');
    expect(source).toContain('data-script-src={umami.scriptUrl}');
    expect(source).toContain('data-website-id={umami.websiteId}');
    expect(source).toContain('data-host-url={umami.hostUrl}');
  });

  it('never references the cloud origin; the config owns that decision', () => {
    expect(source).not.toContain('cloud.umami.is');
  });
});

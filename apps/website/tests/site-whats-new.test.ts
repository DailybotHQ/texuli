/**
 * /whats-new/ (PLAN_010 T-site-080, Amendment 8): the hub covers every
 * new package and capability of 0.6.0 to 0.8.0, with the release statuses
 * the repository states (0.6.0, 0.7.0 and 0.8.0 on npm, 0.8.0 current and
 * the first release of its three packages), every feature linking to a
 * page that exists, live demos as lazy islands, no HTML sinks, and the
 * hub linked from the home page and the sidebar.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLineVersion, releaseLine } from '../../../scripts/release-line.ts';
import { NAV_GROUPS } from '../src/components/foundation/site.ts';
import { WEB_HERO_NEWS } from '../src/components/sections/web/web-hero-content.ts';
import { FEATURES, RELEASES } from '../src/components/whats-new/features.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/whats-new/index.astro');
const ISLANDS = ['HubDashboard', 'HubForm', 'HubLocale', 'HubMotion', 'HubSheet'];
/** The section data of the pages the hub links into (their ids render as anchors). */
const PAGE_DATA = readdirSync(resolve('apps/website/src/components'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => resolve('apps/website/src/components', entry.name, 'page.ts'))
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, 'utf8'));

function pageFile(href: string): string {
  const path = href.replace(/#.*$/, '').replace(/^\/|\/$/g, '');
  return resolve('apps/website/src/pages', path, 'index.astro');
}

describe('whats-new hub', () => {
  it('covers every new package and capability, grouped by release', () => {
    expect(FEATURES.map((feature) => feature.id).sort()).toEqual(
      [
        'agent-service',
        'canvas',
        'contract',
        'dashboards',
        'documents',
        'forms',
        'i18n',
        'motion',
        'output',
        'pages',
        'sheets',
        'sources',
        'streaming',
      ].sort()
    );
    const ids = FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const feature of FEATURES) {
      expect(RELEASES.map((release) => release.id)).toContain(feature.release);
      expect(existsSync(pageFile(feature.href)), feature.href).toBe(true);
      const anchor = feature.href.split('#')[1];
      if (anchor) {
        const sources = [readFileSync(pageFile(feature.href), 'utf8'), ...PAGE_DATA];
        expect(
          sources.some(
            (source) => source.includes(`id="${anchor}"`) || source.includes(`id: '${anchor}'`)
          ),
          feature.href
        ).toBe(true);
      }
    }
  });

  it('states each release the way the repository does', () => {
    const byId = Object.fromEntries(RELEASES.map((release) => [release.id, release]));
    expect(byId['0.6.0']?.published).toBe(true);
    expect(byId['0.7.0']?.published).toBe(true);
    expect(byId['0.7.0']?.status).toContain('Published on npm as 0.7.0');
    expect(byId['0.8.0']?.published).toBe(true);
    // The current release is the first of the published line in
    // docs/RELEASE.md (a version in development is not on the page as
    // published).
    const line = releaseLine();
    const current = `${line.published}.0`;
    expect(byId[current]?.status).toContain(`Published on npm as ${current}, the current release`);
    if (line.development) expect(byId[line.development]?.published ?? false).toBe(false);
    // The manifests carry a version of the release line, the three packages
    // 0.8.0 publishes for the first time included.
    for (const name of ['forms', 'canvas', 'sheets', 'document']) {
      const pkg = JSON.parse(readFileSync(resolve(`packages/${name}/package.json`), 'utf8')) as {
        version: string;
      };
      expect(isLineVersion(pkg.version, line), `${name} ${pkg.version}`).toBe(true);
    }
    for (const release of RELEASES)
      expect(`${release.title} ${release.status} ${release.summary}`).not.toMatch(
        /unreleased|coming in|not on npm/i
      );
    // The agent service is not called deployed or published.
    const service = FEATURES.find((feature) => feature.id === 'agent-service');
    expect(service?.note).toContain('not deployed');
    // i18n says translations beyond English are planned.
    expect(FEATURES.find((feature) => feature.id === 'i18n')?.summary).toContain(
      'translations beyond English are planned'
    );
  });

  it('mounts its live demos as client:visible islands and writes no HTML sink', () => {
    const islands = [...PAGE.matchAll(/<(Hub\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name).sort()).toEqual(ISLANDS);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    expect(FEATURES.filter((feature) => feature.demo === 'live')).toHaveLength(ISLANDS.length);
    for (const source of [
      PAGE,
      ...ISLANDS.map((name) => read(`components/whats-new/${name}.svelte`)),
    ]) {
      expect(source).not.toMatch(/\{@html|set:html|innerHTML|srcdoc/);
      expect(source).not.toMatch(/production[- ]ready|is released|available on npm/i);
    }
    expect(PAGE).toMatch(/<EmailFrame\s+client:visible/);
    expect((PAGE.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it('is linked from the home page hero and the sidebar', () => {
    expect(WEB_HERO_NEWS.href).toBe('/whats-new/');
    expect(WEB_HERO_NEWS.label).not.toMatch(/\d+\.\d+\.\d+|npm/);
    const links = NAV_GROUPS.flatMap((group) => group.links.map((link) => link.href));
    expect(links).toContain('/whats-new/');
    for (const href of ['/sheets-page/', '/dashboards-page/', '/output-page/']) {
      expect(links).toContain(href);
    }
  });
});

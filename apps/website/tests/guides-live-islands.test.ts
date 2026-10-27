/**
 * Every guide's live snippet is mounted (docs/site-guides.md: each guide
 * includes a live Texuli snippet that actually runs). Regression: 7996bbd7
 * rewrote getting-started and dropped `<GettingStartedLive client:load />`,
 * leaving the island orphaned and the page with nothing live.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const guidesDir = join(srcDir, 'components/guides');
const pagesDir = join(srcDir, 'pages/guides');

const liveIslands = readdirSync(guidesDir)
  .filter((file) => file.endsWith('Live.svelte'))
  .map((file) => file.replace(/\.svelte$/, ''))
  .sort();

const pages = readdirSync(pagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    slug: entry.name,
    source: readFileSync(join(pagesDir, entry.name, 'index.astro'), 'utf8'),
  }));

describe('guide live islands', () => {
  it('finds the live islands', () => {
    expect(liveIslands).toContain('GettingStartedLive');
    expect(liveIslands.length).toBeGreaterThanOrEqual(7);
  });

  for (const island of liveIslands) {
    it(`${island} is imported and hydrated by a guide page`, () => {
      const mounting = pages.filter(
        ({ source }) =>
          source.includes(`import ${island} from '../../../components/guides/${island}.svelte'`) &&
          new RegExp(`<${island}\\s[^>]*client:(load|visible|idle)`).test(source)
      );
      expect(mounting.map((page) => page.slug)).toHaveLength(1);
    });
  }

  it('getting-started mounts its live example under a heading in the table of contents', () => {
    const page = pages.find(({ slug }) => slug === 'getting-started');
    expect(page?.source).toContain(
      "{ id: 'live-example', label: 'Live example', level: 2 as const }"
    );
    expect(page?.source).toContain('<h2 id="live-example">Live example</h2>');
  });
});

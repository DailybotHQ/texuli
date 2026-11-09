import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';

const SRC = resolve(import.meta.dirname, '../../src');
const REPLACED = SOLUTIONS.map((entry) => entry.replaces ?? '').filter(Boolean);

/**
 * Files that may name a replaced route without linking it:
 * - the replaced pages themselves and the `*-site` components only they render (the 301
 *   makes them unreachable; they stay in the build until a later cleanup);
 * - route-keyed configuration for pages that are still built (budgets, OG accents);
 * - the registry (`replaces`) and the redirect machinery;
 * - the search index, which `search-sitemap.test.ts` covers.
 */
const ALLOWED = [
  /^pages\/(slides|documents|workflows|canvas|sheets)-page\//,
  /^components\/(slides|documents|workflows|canvas|sheets)-site\//,
  /^components\/perf\/budgets\.ts$/,
  /^components\/seo\/seo\.ts$/,
  /^data\/solutions\/entries\//,
  /^components\/search\//,
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(astro|ts|svelte|md)$/.test(name) ? [path] : [];
  });
}

/** A link-like use: href/live/link values or Markdown links, not prose or comments. */
function linkUses(source: string, route: string): number {
  const bare = route.slice(0, -1);
  const escaped = bare.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const pattern = new RegExp(
    `(?:href|live|link|to)\\s*[:=]\\s*\\{?\\s*[\`'"]${escaped}(?:/(?!json/)[^\`'"]*)?[\`'"]|\\]\\(${escaped}/?(?:#[^)]*)?\\)`,
    'g'
  );
  return [...source.matchAll(pattern)].length;
}

describe('internal links point at canonical URLs (ADR-028)', () => {
  it('no live page links a *-page route that now redirects to its Solution landing', () => {
    const offenders: string[] = [];
    for (const path of files(SRC)) {
      const rel = relative(SRC, path);
      if (ALLOWED.some((rule) => rule.test(rel))) continue;
      const source = readFileSync(path, 'utf8');
      for (const route of REPLACED) {
        const count = linkUses(source, route);
        if (count > 0) offenders.push(`${rel}: ${count} link(s) to ${route}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps /workflows-page/json/ linked (it is not moved)', () => {
    const site = readFileSync(join(SRC, 'components/foundation/site.ts'), 'utf8');
    expect(site).toContain("href: '/workflows-page/json/'");
  });

  it('the pattern catches a stale link (control)', () => {
    expect(linkUses(`{ href: '/slides-page/' }`, '/slides-page/')).toBe(1);
    expect(linkUses(`<a href="/canvas-page/#editor">`, '/canvas-page/')).toBe(1);
    expect(linkUses(`[demo](/sheets-page/)`, '/sheets-page/')).toBe(1);
    expect(linkUses(`{ href: '/workflows-page/json/' }`, '/workflows-page/')).toBe(0);
    expect(linkUses(`// replaces /slides-page/`, '/slides-page/')).toBe(0);
  });
});

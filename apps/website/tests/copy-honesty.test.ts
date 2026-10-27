/**
 * T-84 — site-wide honesty guard for the copy pass (routed from the wave-3
 * interim review). Each banned phrase is a claim the repository contradicts:
 *
 * - size: `docs/CI.md` tracks `pnpm size` entries without a budget row or over
 *   budget, and site-perf reds, so "every subpath ships under a budget" and
 *   "stays inside strict size budgets" are false;
 * - native targets: `native/README.md` — `texuli-compose` is JVM only, iOS
 *   compiles for `texuli-spec` only, Android is pending a decision;
 * - native parity: the golden gate compares role, accessible name and heading
 *   level on the spec goldens, not keyboard, focus or interaction behavior,
 *   and nothing in `native/` ports the texels of `@texuli/core`.
 *
 * The scan covers every source file the site renders copy from.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const siteRoot = join(import.meta.dirname, '..');
const srcRoot = join(siteRoot, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path);
    return /\.(astro|svelte|ts|md)$/.test(entry.name) ? [path] : [];
  });
}

const copies = new Map<string, string>();

/**
 * Visible copy only: comments carry the ban lists themselves, and copy wraps
 * across lines. Computed once per file; both scans below share it.
 */
function copyOf(file: string): string {
  const cached = copies.get(file);
  if (cached !== undefined) return cached;
  const copy = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ');
  copies.set(file, copy);
  return copy;
}

const BANNED: readonly { phrase: RegExp; why: string }[] = [
  { phrase: /every subpath ships under a budget/i, why: 'docs/CI.md tracks size reds' },
  { phrase: /stays? inside strict size budgets/i, why: 'docs/CI.md tracks site-perf reds' },
  {
    phrase: /Android, desktop and iOS targets/i,
    why: 'Texuli targets JVM (renderer) and iOS (spec only); Android is pending',
  },
  { phrase: /rule for rule/i, why: 'the texels are not ported to native' },
  { phrase: /Behavior patterns cross/i, why: 'the trace covers semantics, not behavior' },
  {
    phrase: /same pattern on native/i,
    why: 'the golden gate compares role, name and heading level only',
  },
  { phrase: /production[- ]ready/i, why: 'nothing is released as stable' },
  {
    phrase: /Nothing is on npm/i,
    why: 'every package is on npm as 0.1.0-next.1 under next, and the site is deployed',
  },
  {
    phrase: /\b0\.1\.0(?!-next)\b(?!<\/code>-)/,
    why: 'name the published prerelease exactly: 0.1.0-next.1',
  },
  {
    phrase: /not released yet/i,
    why: 'the prerelease is published; say "no stable release yet" instead',
  },
  { phrase: /token engine/i, why: 'the word list calls @texuli/tokens the theme engine' },
  {
    phrase: /See the badge component rendered/i,
    why: 'one call to action, one label: "See the badge rendered on the web"',
  },
  { phrase: /stable release is (out|available|published)/i, why: 'latest is reserved for 1.0.0' },
];

describe('site copy honesty', () => {
  const files = sourceFiles(srcRoot);

  it('never uses a banned claim anywhere in the rendered source tree', () => {
    expect(files.length).toBeGreaterThan(100);
    for (const { phrase, why } of BANNED) {
      const hits = files
        .filter((file) => phrase.test(copyOf(file)))
        .map((file) => relative(siteRoot, file));
      expect(hits, `${phrase.source} (${why})`).toEqual([]);
    }
  });

  it('keeps every guide table of contents pointing at a heading on its page', () => {
    const guides = files.filter((file) => /pages\/guides\/[^/]+\/index\.astro$/.test(file));
    expect(guides.length).toBeGreaterThan(3);
    const broken: string[] = [];
    for (const file of guides) {
      const source = readFileSync(file, 'utf8');
      for (const [, id] of source.matchAll(/\{ id: '([^']+)', label: /g)) {
        if (!new RegExp(`id="${id}"`).test(source))
          broken.push(`${relative(siteRoot, file)}#${id}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('never calls a published package unpublished', () => {
    // The 15 packages at 0.1.0-next.1 are on npm under next; only the
    // private 0.0.0 workspaces (editor, examples) are unpublished.
    const published = readdirSync(join(siteRoot, '..', '..', 'packages')).filter((dir) => {
      try {
        const pkg = JSON.parse(
          readFileSync(join(siteRoot, '..', '..', 'packages', dir, 'package.json'), 'utf8')
        ) as { version?: string };
        return pkg.version === '0.1.0-next.1';
      } catch {
        return false;
      }
    });
    expect(published).toHaveLength(15);
    const wrong: string[] = [];
    for (const file of files) {
      const copy = copyOf(file);
      for (const dir of published) {
        const name = dir === 'texuli' ? 'texuli' : `@texuli/${dir}`;
        // The bare `texuli` package must not match inside `@texuli/<name>`.
        const pattern = dir === 'texuli' ? '(?<![@/\\w])texuli(?![/\\w])' : `@texuli\\/${dir}\\b`;
        const claim = new RegExp(`${pattern}.{0,400}?\\bnot published to npm`, 'i');
        if (claim.test(copy)) wrong.push(`${relative(siteRoot, file)}: ${name}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

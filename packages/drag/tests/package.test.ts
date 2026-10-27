// @vitest-environment node
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as {
  exports: Record<string, { types: string; default: string }>;
  dependencies?: Record<string, string>;
};
const sources = readdirSync(new URL('src/', root)).filter((file) => file.endsWith('.ts'));

describe('@texuli/drag packaging and SSR safety', () => {
  it('exports every subpath, each pointing at its source', () => {
    expect(Object.keys(pkg.exports)).toEqual([
      '.',
      './sortable',
      './collision',
      './modifiers',
      './auto-scroll',
      './gesture',
      './spatial',
      './graph',
      './messages',
      './testing',
    ]);
    for (const [subpath, entry] of Object.entries(pkg.exports)) {
      const file = subpath === '.' ? './src/index.ts' : `./src/${subpath.slice(2)}.ts`;
      expect(entry).toEqual({ types: file, default: file });
    }
    // geometry and session ship through the root entry.
    const exported = new Set(
      Object.values(pkg.exports).map((entry) => entry.default.replace('./src/', ''))
    );
    expect(sources.filter((file) => !exported.has(file)).sort()).toEqual([
      'geometry.ts',
      'session.ts',
    ]);
  });

  it('has no runtime dependencies and imports nothing outside itself', () => {
    expect(pkg.dependencies ?? {}).toEqual({});
    for (const file of sources) {
      const text = readFileSync(new URL(`src/${file}`, root), 'utf8');
      for (const [, specifier] of text.matchAll(/from '([^']+)'/g))
        expect(specifier, file).toMatch(/^\.\/[\w-]+\.ts$/);
    }
  });

  it('never touches browser globals or HTML sinks', () => {
    for (const file of sources) {
      // Code only: doc comments may name the browser APIs a caller supplies.
      const text = readFileSync(new URL(`src/${file}`, root), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(text, file).not.toMatch(
        /\b(window|document|navigator|globalThis|requestAnimationFrame|setTimeout)\b/
      );
      expect(text, file).not.toMatch(
        /innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function/
      );
    }
  });

  it('loads every entry in plain Node without a DOM', async () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    for (const entry of Object.values(pkg.exports)) {
      const module = await import(new URL(entry.default, root).href);
      expect(Object.keys(module).length).toBeGreaterThan(0);
    }
  });
});

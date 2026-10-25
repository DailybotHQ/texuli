// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Examples register through side-effect imports in src/index.ts. A bundler
 * keeps a side-effect import only when the file matches package.json
 * `sideEffects`, so a registration file with another name silently vanishes
 * from production builds (the fixture app then says "Unknown fixture"). This
 * holds every registration import to the declared patterns.
 */
const ROOT = join(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  sideEffects: string[];
};
const index = readFileSync(join(ROOT, 'src/index.ts'), 'utf8');

/** `./src/**\/entry.ts` → a RegExp over `./src/...` paths. */
function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.+/)?')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

describe('example registration survives tree-shaking', () => {
  it('every side-effect import in src/index.ts matches package.json sideEffects', () => {
    const patterns = manifest.sideEffects.map(patternToRegExp);
    const imports = [...index.matchAll(/^import '(\.\/[^']+)';$/gm)].map(
      (match) => `./src/${(match[1] as string).slice(2)}`
    );
    expect(imports.length).toBeGreaterThan(50);
    const unmatched = imports.filter((path) => !patterns.some((pattern) => pattern.test(path)));
    expect(unmatched).toEqual([]);
  });
});

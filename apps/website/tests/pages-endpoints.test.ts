/**
 * Astro treats every `.ts` file under `src/pages/` as an endpoint. A helper
 * module there has no handler, so the build emits a stray, handler-less route
 * (a 404 page at an extension-less URL) and warns "No API Route handler".
 * Helpers live under `src/components/`; a `.ts` file in `src/pages/` must
 * export a GET handler or start with `_` (Astro ignores those).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagesRoot = join(import.meta.dirname, '..', 'src', 'pages');

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : tsFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.startsWith('_') ? [path] : [];
  });
}

describe('src/pages holds routes only', () => {
  it('every .ts module under src/pages exports a GET handler', () => {
    const handlerless = tsFiles(pagesRoot)
      .filter(
        (file) =>
          !/export\s+(const|async\s+function|function)\s+GET\b/.test(readFileSync(file, 'utf8'))
      )
      .map((file) => relative(pagesRoot, file));
    expect(handlerless).toEqual([]);
  });
});

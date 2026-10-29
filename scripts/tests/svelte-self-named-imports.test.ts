// @vitest-environment node
/**
 * Guard for the packed Svelte declarations (T-std-consumers). svelte2tsx emits
 * `declare const <FileName>: Component<…>; type <FileName> = …` for every
 * `<FileName>.svelte`, so a component that imports a binding named like its
 * own file (`import type { PollBlock } from './schema.ts'` in
 * `PollBlock.svelte`) ships a `.svelte.d.ts` that fails every consumer's type
 * check with TS2440 ("Import declaration conflicts with local declaration").
 * The source typecheck cannot see it: only the emitted file has both names.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function svelteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...svelteFiles(full));
    else if (entry.name.endsWith('.svelte')) out.push(full);
  }
  return out;
}

/** Local bindings of every `import … from` in a source text. */
function importedBindings(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/\bimport\s+(type\s+)?([^'";]*?)\s+from\s+['"][^'"]+['"]/g)) {
    const clause = match[2] as string;
    const braces = clause.match(/\{([^}]*)\}/);
    const outside = clause
      .replace(/\{[^}]*\}/, '')
      .replace(/,/g, ' ')
      .trim();
    // `Default`, `* as Namespace` or both: every word but `*` and `as` is a binding.
    for (const part of outside.split(/\s+/)) {
      if (part && part !== '*' && part !== 'as') names.push(part);
    }
    for (const spec of (braces?.[1] ?? '').split(',')) {
      const words = spec
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/);
      const local = (words[1] ?? words[0] ?? '').trim();
      if (local) names.push(local);
    }
  }
  return names;
}

describe('Svelte components never import a binding named like their file', () => {
  it('parses default, named, aliased, type-only and namespace bindings', () => {
    expect(
      importedBindings(
        [
          "import Self from './A.svelte';",
          "import { type PollBlock as PollBlockData, evaluate } from './schema.ts';",
          "import type { QuizBlock } from './schema.ts';",
          "import * as Accordion from './accordion';",
        ].join('\n')
      )
    ).toEqual(['Self', 'PollBlockData', 'evaluate', 'QuizBlock', 'Accordion']);
  });

  it('holds for every .svelte file under packages/*/src', () => {
    const packages = join(ROOT, 'packages');
    const files = readdirSync(packages, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        try {
          return svelteFiles(join(packages, entry.name, 'src'));
        } catch {
          return [];
        }
      });
    expect(files.length).toBeGreaterThan(100);
    const clashes = files.flatMap((file) => {
      const name = basename(file, '.svelte');
      return importedBindings(readFileSync(file, 'utf8')).includes(name)
        ? [`${relative(ROOT, file)} imports ${name}`]
        : [];
    });
    expect(clashes).toEqual([]);
  });
});

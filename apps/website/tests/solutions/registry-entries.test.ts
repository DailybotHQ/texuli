import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SLIDES_DEMO_SCENARIOS } from '../../src/components/solutions/slides/demo/fixtures/index.ts';
import { getSolution, SOLUTIONS } from '../../src/data/solutions/index.ts';
import { checkSolutionRegistry, SOLUTION_SLUGS } from '../../src/data/solutions/schema.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const WEBSITE = join(ROOT, 'apps/website');

function packageExports(name: string): Set<string> | undefined {
  const dir = name === 'texuli' ? 'texuli' : name.replace('@texuli/', '');
  const file = join(ROOT, 'packages', dir, 'package.json');
  if (!existsSync(file)) return undefined;
  const pkg = JSON.parse(readFileSync(file, 'utf8')) as {
    name: string;
    exports?: Record<string, unknown>;
  };
  return pkg.name === name ? new Set(Object.keys(pkg.exports ?? {})) : undefined;
}

describe('Solutions registry entries', () => {
  it('lists the five promoted Solutions in catalog order and passes the contract', () => {
    expect(SOLUTIONS.map((s) => s.slug)).toEqual([...SOLUTION_SLUGS]);
    expect(checkSolutionRegistry(SOLUTIONS)).toEqual([]);
    expect(getSolution('canvas').name).toBe('Canvas');
  });

  it('marks every Solution in development and keeps native targets planned', () => {
    for (const entry of SOLUTIONS) {
      expect(entry.status, entry.slug).toBe('in development');
      for (const p of entry.platforms.filter((p) => p.platform !== 'web')) {
        expect(p.status, `${entry.slug} ${p.platform}`).toBe('planned');
      }
    }
  });

  it('names real packages and subpath exports', () => {
    for (const entry of SOLUTIONS) {
      for (const pkg of entry.packages) {
        const exports = packageExports(pkg.name);
        expect(exports, pkg.name).toBeDefined();
        for (const sub of pkg.subpaths) expect(exports?.has(sub), `${pkg.name} ${sub}`).toBe(true);
      }
    }
  });

  it('uses the demo fixtures as scenarios', () => {
    expect(getSolution('slides').demo.scenarios).toEqual(SLIDES_DEMO_SCENARIOS.map((s) => s.id));
    for (const entry of SOLUTIONS.filter((s) => s.slug !== 'slides')) {
      const fixtures = join(WEBSITE, 'src/components/solutions', entry.slug, 'demo/fixtures');
      for (const id of entry.demo.scenarios) {
        expect(existsSync(join(fixtures, `${id}.ts`)), `${entry.slug} ${id}`).toBe(true);
      }
    }
  });

  it('uses the hero plate slot and replaces an existing page route', () => {
    for (const entry of SOLUTIONS) {
      expect(entry.art.hero).toEqual({ slot: `solution-${entry.slug}-hero`, variant: 'plate' });
      expect(entry.replaces).toBe(`/${entry.slug}-page/`);
      expect(existsSync(join(WEBSITE, `src/pages/${entry.slug}-page/index.astro`))).toBe(true);
    }
  });
});

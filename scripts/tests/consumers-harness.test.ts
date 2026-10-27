// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PINNED } from '../../tests/consumers/fixtures/versions.ts';
import {
  assertInstalledFromTarballs,
  CONSUMER_PACK_FILTER,
  CONSUMERS,
  REPO_ROOT,
  TEXULI_INSTALL_NAMES,
} from '../../tests/consumers/harness.ts';

describe('consumer harness matrix', () => {
  it('lists six fixtures across three frameworks with and without Tailwind; typechecks vite and sveltekit consumers (svelte-check + tsc) without local css ambient; pins every third-party fixture dependency exactly (no ^ or ~); installs with ignore-scripts and prefer-offline, never legacy-peer-deps; exports assertInstalledFromTarballs that requires file: tarball resolution', () => {
    expect(CONSUMERS).toHaveLength(6);
    expect(CONSUMERS.map((c) => c.id).sort()).toEqual(
      [
        'astro-plain',
        'astro-tailwind',
        'sveltekit-plain',
        'sveltekit-tailwind',
        'vite-plain',
        'vite-tailwind',
      ].sort()
    );
    expect(new Set(CONSUMERS.map((c) => c.framework)).size).toBe(3);
    expect(CONSUMERS.filter((c) => c.tailwind)).toHaveLength(3);
    expect(CONSUMER_PACK_FILTER).toEqual(['core', 'tokens', 'primitives', 'texuli', 'data']);
    expect([...TEXULI_INSTALL_NAMES]).toEqual([
      '@texuli/core',
      '@texuli/tokens',
      '@texuli/primitives',
      'texuli',
      '@texuli/data',
    ]);
    expect(REPO_ROOT).toMatch(/texuli/);
    expect(typeof assertInstalledFromTarballs).toBe('function');
    // typechecks vite and sveltekit consumers (svelte-check + tsc) without local css ambient
    {
      const harnessSrc = readFileSync(join(REPO_ROOT, 'tests/consumers/harness.ts'), 'utf8');
      expect(harnessSrc).toContain('export async function typecheckConsumer');
      expect(harnessSrc).toContain('export function assertPackedCssTypes');
      expect(harnessSrc).toContain('noUncheckedSideEffectImports');
      expect(harnessSrc).toContain("TYPECHECK_FRAMEWORKS = ['vite', 'sveltekit']");
      const smoke = readFileSync(join(REPO_ROOT, 'tests/consumers/fixtures/Smoke.svelte'), 'utf8');
      expect(smoke).toContain("from 'texuli/button'");
      expect(smoke).toContain("from 'texuli/select'");
      expect(smoke).toContain("from '@texuli/data/grid-core'");
    }
    // pins every third-party fixture dependency exactly (no ^ or ~)
    {
      const fixturesDir = join(REPO_ROOT, 'tests/consumers/fixtures');
      const fixtureDirs = readdirSync(fixturesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      expect(fixtureDirs.length).toBeGreaterThanOrEqual(6);

      for (const name of fixtureDirs) {
        const pkgPath = join(fixturesDir, name, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const all = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const [dep, version] of Object.entries(all)) {
          if (version.startsWith('file:')) {
            expect(version).toMatch(/^file:PLACEHOLDER_/);
            continue;
          }
          expect(version, `${name} ${dep}`).not.toMatch(/^[\^~]/);
          expect(version, `${name} ${dep}`).toMatch(/^\d+\.\d+\.\d+/);
          if (dep in PINNED) {
            expect(version, `${name} ${dep} matches PINNED`).toBe(
              PINNED[dep as keyof typeof PINNED]
            );
          }
        }
      }
    }
    // installs with ignore-scripts and prefer-offline, never legacy-peer-deps
    {
      const harnessSrc = readFileSync(join(REPO_ROOT, 'tests/consumers/harness.ts'), 'utf8');
      // Install args appear as a single array literal — no legacy-peer-deps flag.
      expect(harnessSrc).toMatch(
        /\['install',\s*'--no-fund',\s*'--no-audit',\s*'--ignore-scripts',\s*'--prefer-offline'\]/
      );
      expect(harnessSrc).not.toMatch(/['"]--legacy-peer-deps['"]/);
    }
    // exports assertInstalledFromTarballs that requires file: tarball resolution
    {
      const harnessSrc = readFileSync(join(REPO_ROOT, 'tests/consumers/harness.ts'), 'utf8');
      expect(harnessSrc).toContain('export function assertInstalledFromTarballs');
      expect(harnessSrc).toContain("startsWith('file:')");
      expect(harnessSrc).toContain('not the registry');
    }
  });
});

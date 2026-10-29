/// <reference types="node" />
/// <reference types="vite/client" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASES, EXCLUDED } from './contract/cases.ts';
import { type ContractCase, checkContract, exportedComponents } from './support/contract.ts';
import { createContractRefs } from './support/contract-refs.svelte.ts';

// One API contract over every exported primitive part (docs/STANDARDS.md,
// "Component API contract"): rest attributes and `bind:ref` on the root
// element, caller handlers composed with the part's own behavior.

const components = import.meta.glob<{ default: unknown }>('../src/**/*.svelte', { eager: true });
const entryModules = import.meta.glob<Record<string, unknown>>('../src/**/index.ts', {
  eager: true,
});

const sources = new Map<unknown, string>();
for (const [path, module] of Object.entries(components)) {
  sources.set(module.default, path.replace('../src/', '').replace(/\.svelte$/, ''));
}

/** The modules behind package.json `exports` (every subpath and the root). */
function exportEntries(): Record<string, unknown>[] {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'packages/primitives/package.json'), 'utf8')
  ) as { exports: Record<string, string | { default: string }> };
  return Object.values(manifest.exports).map((target) => {
    const file = typeof target === 'string' ? target : target.default;
    const module = entryModules[file.replace('./src/', '../src/')];
    if (!module) throw new Error(`export ${file} is not an index.ts module`);
    return module;
  });
}

const exported = exportedComponents(exportEntries(), sources);
const KEYS = CASES.map((c) => c.key);
const byKey = new Map<string, ContractCase>(CASES.map((c) => [c.key, c]));

describe('component API contract', () => {
  it('covers every exported component (a case or a documented exclusion)', () => {
    expect(exported.size).toBeGreaterThan(150);
    const missing = [...exported.keys()].filter((key) => !byKey.has(key) && !(key in EXCLUDED));
    expect(missing).toEqual([]);
    const stale = [...byKey.keys(), ...Object.keys(EXCLUDED)].filter((key) => !exported.has(key));
    expect(stale).toEqual([]);
  });

  const observed: string[] = [];
  for (const c of CASES) {
    it(`${c.key}: rest attributes, bind:ref and composed handlers`, async () => {
      const result = await checkContract(c, () => createContractRefs(KEYS));
      observed.push(...result.observed.map((event) => `${c.key}:${event}`));
      expect(result.failures).toEqual([]);
    });
  }

  it('observes the own behavior of the interactive parts (the composition checks bite)', () => {
    expect(observed.length).toBeGreaterThan(200);
  });
});

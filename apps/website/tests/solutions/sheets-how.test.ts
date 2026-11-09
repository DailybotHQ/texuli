import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { architectureView } from '../../src/components/solutions/shared/architecture/architecture-model.ts';
import { PACKAGE_STACK } from '../../src/components/solutions/shared/architecture/package-stack.ts';
import {
  SHEETS_HOW,
  SHEETS_HOW_TRACE,
} from '../../src/components/solutions/sheets/how/how-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const entry = getSolution('sheets');

/** Every workspace package manifest, by npm name. */
const manifests = new Map<
  string,
  {
    exports: Record<string, unknown>;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }
>(
  readdirSync(resolve(REPO, 'packages'), { withFileTypes: true })
    .filter((dir) => dir.isDirectory())
    .map((dir) =>
      JSON.parse(readFileSync(resolve(REPO, 'packages', dir.name, 'package.json'), 'utf8'))
    )
    .map((pkg) => [pkg.name as string, pkg])
);
const wordCount = (text: string) => text.trim().split(/\s+/).length;

describe('Sheets how it works', () => {
  it('walks model → calculate → edit → exchange', () => {
    expect(SHEETS_HOW.steps.map((step) => step.title)).toEqual([
      'Model',
      'Calculate',
      'Edit',
      'Exchange',
    ]);
    expect(SHEETS_HOW.steps.map((step) => step.package)).toEqual([
      '@texuli/sheets',
      '@texuli/sheets',
      '@texuli/sheets',
      '@texuli/sheets',
    ]);
  });

  it('names only registry packages, exported subpaths and registry capabilities', () => {
    expect(SHEETS_HOW_TRACE).toHaveLength(SHEETS_HOW.steps.length);
    const capabilities = new Set(entry.capabilities.map((capability) => capability.id));
    for (const [index, step] of SHEETS_HOW.steps.entries()) {
      const trace = SHEETS_HOW_TRACE[index];
      if (!trace || !step.package) throw new Error(`Step ${index} lacks a package or trace.`);
      const pkg = entry.packages.find((candidate) => candidate.name === step.package);
      expect(pkg, step.package).toBeDefined();
      expect(pkg?.subpaths, `${step.title} ${trace.subpath}`).toContain(trace.subpath);
      expect(Object.keys(manifests.get(step.package)?.exports ?? {})).toContain(trace.subpath);
      expect(capabilities.has(trace.capability), trace.capability).toBe(true);
    }
    expect(new Set(SHEETS_HOW_TRACE.map((trace) => trace.capability))).toEqual(
      new Set(['edit', 'formulas', 'csv'])
    );
  });

  it('builds a diagram from registry packages and their real dependencies', () => {
    const view = architectureView({ entry, ...SHEETS_HOW });
    expect(view.headingId).toBe('solution-how-sheets');
    expect(view.packages.map((pkg) => pkg.name)).toEqual(['@texuli/sheets']);
    expect(view.packages.map((pkg) => pkg.layerLabel)).toEqual(['L5']);
    for (const pkg of [...view.packages, ...view.foundation]) {
      expect(manifests.has(pkg.name), pkg.name).toBe(true);
      expect(PACKAGE_STACK[pkg.name], pkg.name).toBeDefined();
    }
    const directDeps = new Set(
      entry.packages.flatMap((own) => {
        const manifest = manifests.get(own.name);
        return Object.keys({ ...manifest?.dependencies, ...manifest?.peerDependencies }).filter(
          (name) => name === 'texuli' || name.startsWith('@texuli/')
        );
      })
    );
    for (const dependency of view.foundation.map((pkg) => pkg.name)) {
      expect(directDeps.has(dependency), dependency).toBe(true);
    }
    expect(view.summary.startsWith('Sheets is built from @texuli/sheets, on ')).toBe(true);
    for (const pkg of view.packages) {
      const registered = entry.packages.find((candidate) => candidate.name === pkg.name);
      expect(pkg.subpaths).toEqual(registered?.subpaths);
      for (const subpath of pkg.subpaths) {
        expect(
          Object.keys(manifests.get(pkg.name)?.exports ?? {}),
          `${pkg.name} ${subpath}`
        ).toContain(subpath);
      }
    }
  });

  it('keeps the copy short, factual and free of plan names or invented counts', () => {
    expect(SHEETS_HOW.title.length).toBeGreaterThan(0);
    for (const step of SHEETS_HOW.steps) {
      expect(wordCount(step.body), step.title).toBeLessThanOrEqual(30);
      expect(step.body, step.title).not.toMatch(/\d/);
      expect(step.body).not.toMatch(/https?:|\/[a-z-]+\/|PLAN_|\bplan\b/i);
      expect(step.body).not.toMatch(/\b(available|hosted|cloud|native|server-side)\b/i);
    }
    expect(JSON.stringify(SHEETS_HOW)).not.toMatch(/\bavailable\b/i);
  });

  it('wraps the shared SolutionHow with the Sheets entry, statically', () => {
    const source = readFileSync(
      resolve(WEBSITE, 'src/components/solutions/sheets/how/SheetsHow.astro'),
      'utf8'
    );
    expect(source).toContain("getSolution('sheets')");
    expect(source).toContain('<SolutionHow entry={entry} {...SHEETS_HOW} />');
    expect(source).not.toMatch(/client:[a-z]+|<script\b|set:html|\{@html/);
  });
});

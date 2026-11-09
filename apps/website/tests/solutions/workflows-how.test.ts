import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { architectureView } from '../../src/components/solutions/shared/architecture/architecture-model.ts';
import { PACKAGE_STACK } from '../../src/components/solutions/shared/architecture/package-stack.ts';
import {
  WORKFLOWS_HOW,
  WORKFLOWS_HOW_TRACE,
} from '../../src/components/solutions/workflows/how/how-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const entry = getSolution('workflows');

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

describe('Workflows how it works', () => {
  it('walks model → lay out → edit → inspect → view', () => {
    expect(WORKFLOWS_HOW.steps.map((step) => step.title)).toEqual([
      'Model',
      'Lay out',
      'Edit',
      'Inspect',
      'View',
    ]);
    expect(WORKFLOWS_HOW.steps.map((step) => step.package)).toEqual([
      '@texuli/workflows',
      '@texuli/workflows',
      '@texuli/workflows',
      '@texuli/workflows',
      '@texuli/workflows',
    ]);
  });

  it('names only registry packages, registry subpaths that the package exports, and registry capabilities', () => {
    expect(WORKFLOWS_HOW_TRACE).toHaveLength(WORKFLOWS_HOW.steps.length);
    const capabilities = new Set(entry.capabilities.map((cap) => cap.id));
    for (const [i, step] of WORKFLOWS_HOW.steps.entries()) {
      const trace = WORKFLOWS_HOW_TRACE[i];
      if (!trace || !step.package) throw new Error(`step ${i} lacks a package or trace`);
      const pkg = entry.packages.find((p) => p.name === step.package);
      expect(pkg, step.package).toBeDefined();
      expect(pkg?.subpaths, `${step.title} ${trace.subpath}`).toContain(trace.subpath);
      expect(Object.keys(manifests.get(step.package)?.exports ?? {})).toContain(trace.subpath);
      expect(capabilities.has(trace.capability), trace.capability).toBe(true);
    }
    for (const id of new Set(WORKFLOWS_HOW_TRACE.map((t) => t.capability)))
      expect(['graph-model', 'layout', 'author', 'view']).toContain(id);
  });

  it('builds the shared block view, whose diagram lists only real packages and their real dependencies', () => {
    const view = architectureView({ entry, ...WORKFLOWS_HOW });
    expect(view.headingId).toBe('solution-how-workflows');
    expect(view.packages.map((p) => p.name)).toEqual(['@texuli/workflows']);
    expect(view.packages.map((p) => p.layerLabel)).toEqual(['L4']);
    expect(view.foundation.map((p) => p.name)).toContain('@texuli/drag');
    for (const pkg of [...view.packages, ...view.foundation]) {
      expect(manifests.has(pkg.name), pkg.name).toBe(true);
      expect(PACKAGE_STACK[pkg.name], pkg.name).toBeDefined();
    }
    const realDeps = new Set(
      entry.packages.flatMap((own) => {
        const m = manifests.get(own.name);
        return Object.keys({ ...m?.dependencies, ...m?.peerDependencies }).filter(
          (name) => name === 'texuli' || name.startsWith('@texuli/')
        );
      })
    );
    for (const dep of view.foundation.map((p) => p.name)) expect(realDeps.has(dep), dep).toBe(true);
    expect(view.summary.startsWith('Workflows is built from @texuli/workflows, on ')).toBe(true);
    for (const pkg of view.packages) {
      const own = entry.packages.find((p) => p.name === pkg.name);
      expect(pkg.subpaths).toEqual(own?.subpaths);
      for (const sub of pkg.subpaths)
        expect(Object.keys(manifests.get(pkg.name)?.exports ?? {}), `${pkg.name} ${sub}`).toContain(
          sub
        );
    }
  });

  it('keeps the copy short, factual and free of counts, links and plan names', () => {
    expect(WORKFLOWS_HOW.title.length).toBeGreaterThan(0);
    for (const step of WORKFLOWS_HOW.steps) {
      expect(wordCount(step.body), step.title).toBeLessThanOrEqual(30);
      expect(step.body, step.title).not.toMatch(/\d/);
      expect(step.body).not.toMatch(/https?:|\/[a-z-]+\/|PLAN_|\bplan\b/i);
      expect(step.body).not.toMatch(/\b(hosted|cloud|native|server-side)\b/i);
    }
    expect(JSON.stringify(WORKFLOWS_HOW)).not.toMatch(/\bavailable\b/);
  });

  it('wraps the shared SolutionHow with the workflows entry, statically', () => {
    const source = readFileSync(
      resolve(WEBSITE, 'src/components/solutions/workflows/how/WorkflowsHow.astro'),
      'utf8'
    );
    expect(source).toContain("getSolution('workflows')");
    expect(source).toContain('<SolutionHow entry={entry} {...WORKFLOWS_HOW} />');
    expect(source).not.toMatch(/client:[a-z]+|<script\b|set:html|\{@html/);
  });
});

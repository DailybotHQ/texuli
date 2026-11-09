import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENTS_HOW,
  DOCUMENTS_HOW_TRACE,
} from '../../src/components/solutions/documents/how/how-content.ts';
import { architectureView } from '../../src/components/solutions/shared/architecture/architecture-model.ts';
import { PACKAGE_STACK } from '../../src/components/solutions/shared/architecture/package-stack.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const entry = getSolution('documents');

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

describe('Documents how it works', () => {
  it('walks author → edit with operations → rich text → edit and read → export → sync', () => {
    expect(DOCUMENTS_HOW.steps.map((step) => step.title)).toEqual([
      'Author',
      'Edit with operations',
      'Write rich text',
      'Edit and read',
      'Export',
      'Sync, if you need it',
    ]);
    expect(DOCUMENTS_HOW.steps.map((step) => step.package)).toEqual([
      '@texuli/document',
      '@texuli/document',
      '@texuli/editor',
      '@texuli/pages',
      '@texuli/document',
      '@texuli/document',
    ]);
  });

  it('names only registry packages, registry subpaths that the package exports, and registry capabilities', () => {
    expect(DOCUMENTS_HOW_TRACE).toHaveLength(DOCUMENTS_HOW.steps.length);
    const capabilities = new Set(entry.capabilities.map((cap) => cap.id));
    for (const [i, step] of DOCUMENTS_HOW.steps.entries()) {
      const trace = DOCUMENTS_HOW_TRACE[i];
      if (!trace || !step.package) throw new Error(`step ${i} lacks a package or trace`);
      const pkg = entry.packages.find((p) => p.name === step.package);
      expect(pkg, step.package).toBeDefined();
      expect(pkg?.subpaths, `${step.title} ${trace.subpath}`).toContain(trace.subpath);
      expect(Object.keys(manifests.get(step.package)?.exports ?? {})).toContain(trace.subpath);
      expect(capabilities.has(trace.capability), trace.capability).toBe(true);
    }
    for (const id of new Set(DOCUMENTS_HOW_TRACE.map((t) => t.capability)))
      expect(['edit', 'read', 'export', 'collaborate']).toContain(id);
  });

  it('builds the shared block view, whose diagram lists only real packages and their real dependencies', () => {
    const view = architectureView({ entry, ...DOCUMENTS_HOW });
    expect(view.headingId).toBe('solution-how-documents');
    expect(view.packages.map((p) => p.name)).toEqual([
      '@texuli/pages',
      '@texuli/editor',
      '@texuli/document',
    ]);
    expect(view.packages.map((p) => p.layerLabel)).toEqual(['L8', 'L4', 'L1']);
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
    expect(
      view.summary.startsWith(
        'Documents is built from @texuli/pages, @texuli/editor and @texuli/document, on '
      )
    ).toBe(true);
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
    expect(DOCUMENTS_HOW.title.length).toBeGreaterThan(0);
    for (const step of DOCUMENTS_HOW.steps) {
      expect(wordCount(step.body), step.title).toBeLessThanOrEqual(30);
      expect(step.body, step.title).not.toMatch(/\d/);
      expect(step.body).not.toMatch(/https?:|\/[a-z-]+\/|PLAN_|\bplan\b/i);
      expect(step.body).not.toMatch(/\b(hosted|cloud|native|server-side)\b/i);
    }
    expect(JSON.stringify(DOCUMENTS_HOW)).not.toMatch(/\bavailable\b/);
  });

  it('wraps the shared SolutionHow with the documents entry, statically', () => {
    const source = readFileSync(
      resolve(WEBSITE, 'src/components/solutions/documents/how/DocumentsHow.astro'),
      'utf8'
    );
    expect(source).toContain("getSolution('documents')");
    expect(source).toContain('<SolutionHow entry={entry} {...DOCUMENTS_HOW} />');
    expect(source).not.toMatch(/client:[a-z]+|<script\b|set:html|\{@html/);
  });
});

describe('Documents how it works scope', () => {
  it('claims no planned capability and keeps sync optional', () => {
    const planned = new Set(
      entry.capabilities.filter((c) => c.status === 'planned').map((c) => c.id)
    );
    for (const t of DOCUMENTS_HOW_TRACE)
      expect(planned.has(t.capability), t.capability).toBe(false);
    expect(JSON.stringify(DOCUMENTS_HOW)).not.toMatch(/paged/i);
    expect(DOCUMENTS_HOW.steps.at(-1)?.body).toMatch(/Your app supplies the transport\./);
  });
});

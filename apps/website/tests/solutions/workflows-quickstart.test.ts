import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorkflowEditor } from '@texuli/workflows/editor';
import { layoutMoves, layoutWorkflow } from '@texuli/workflows/layout';
import { applyWorkflowOps, createWorkflow, defineNodeTypes } from '@texuli/workflows/model';
import { compile as compileSvelte } from 'svelte/compiler';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { SolutionCodeSample } from '../../src/components/solutions/shared/types.ts';
import {
  WORKFLOWS_BUILD_OPS,
  WORKFLOWS_CREATE_SAMPLE,
  WORKFLOWS_EDITOR_SAMPLE,
  WORKFLOWS_INSTALL,
  WORKFLOWS_LAYOUT_SAMPLE,
  WORKFLOWS_NODE_TYPES,
  WORKFLOWS_QUICKSTART_VERIFIED_BY,
  workflowsQuickstart,
} from '../../src/components/solutions/workflows/quickstart/samples.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');

function compileSample(sample: SolutionCodeSample): void {
  switch (sample.language) {
    case 'bash':
      execFileSync('bash', ['-n'], { input: sample.code, encoding: 'utf8' });
      return;
    case 'ts': {
      const result = ts.transpileModule(sample.code, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          strict: true,
        },
        reportDiagnostics: true,
      });
      expect(result.diagnostics ?? []).toEqual([]);
      expect(result.outputText.trim()).not.toBe('');
      return;
    }
    case 'svelte': {
      const result = compileSvelte(sample.code, {
        filename: 'workflows-quickstart.svelte',
        generate: 'client',
      });
      expect(result.warnings).toEqual([]);
      expect(result.js.code.trim()).not.toBe('');
      return;
    }
    default:
      throw new Error(`unexpected language ${sample.language}`);
  }
}

describe('Workflows quickstart', () => {
  it('feeds the shared Quickstart block with real workflows exports', () => {
    const entry = getSolution('workflows');
    const props = workflowsQuickstart(entry);
    expect(props.entry.slug).toBe('workflows');
    expect(props.install.code).toBe(WORKFLOWS_INSTALL);
    expect(props.verifiedBy).toBe(WORKFLOWS_QUICKSTART_VERIFIED_BY);
    expect(props.samples.map((sample) => sample.language)).toEqual(['ts', 'ts', 'svelte']);
    const layout = read('src/components/solutions/workflows/quickstart/WorkflowsQuickstart.astro');
    expect(layout).toContain('Quickstart.astro');
    expect(layout).toContain('workflowsQuickstart');
    expect(layout).not.toMatch(/PLAN_015|\/solutions\/workflows\/|\/workflows-page\//);
  });

  it('compiles every sample and runs the same calls against workspace packages', () => {
    const props = workflowsQuickstart(getSolution('workflows'));
    for (const sample of [props.install, ...props.samples]) {
      expect(() => compileSample(sample), sample.label).not.toThrow();
    }

    expect(WORKFLOWS_CREATE_SAMPLE).toContain("from '@texuli/workflows/model'");
    expect(WORKFLOWS_LAYOUT_SAMPLE).toContain("from '@texuli/workflows/layout'");
    expect(WORKFLOWS_EDITOR_SAMPLE).toContain("from '@texuli/workflows/editor'");

    const registry = defineNodeTypes(WORKFLOWS_NODE_TYPES);
    const built = applyWorkflowOps(createWorkflow(), WORKFLOWS_BUILD_OPS, { registry });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.graph.nodes.map((node) => node.id)).toEqual(['ask', 'lead', 'paid']);
      const moves = layoutMoves(layoutWorkflow(built.graph, { direction: 'LR' }));
      const laid = applyWorkflowOps(built.graph, [{ op: 'moveNodes', moves }], { registry });
      expect(laid.ok).toBe(true);
    }

    expect(typeof WorkflowEditor).toBe('function');
  });
});

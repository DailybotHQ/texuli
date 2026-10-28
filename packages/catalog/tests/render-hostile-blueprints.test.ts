// @vitest-environment node
import { type Schema, validateBlueprint } from '@texuli/spec';
import { projectCatalog } from '@texuli/spec/codegen';
import { validateWorkflowGraph } from '@texuli/spec/workflow';
import { describe, expect, it } from 'vitest';
import blueprintJson from '../../spec/schemas/blueprint.schema.json';
import workflowJson from '../../spec/schemas/workflow.schema.json';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { assertInertRoots, HOSTILE_BLUEPRINTS } from '../src/render/hostile/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import { validateDraft } from '../src/validate/index.ts';

/**
 * The spec 0.3.0 hostile corpus: workflow cycles and size bombs, bidi,
 * javascript: text, oversized or smuggled reorder, unknown ids, props,
 * events and actions, bindings and prototype keys. Each is refused, naming
 * an expected code; nothing is evaluated.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const documents = {
  blueprintSchema: blueprintJson as unknown as Schema,
  catalog: projectCatalog(build.catalog, build.hash),
  workflowSchema: workflowJson as unknown as Schema,
  validateWorkflowGraph,
};

function envelope(sample: (typeof HOSTILE_BLUEPRINTS)[number]): unknown {
  if (sample.text !== undefined) return sample.text.replace('__CATALOG__', build.hash);
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: `hostile-${sample.id}`,
    catalog: build.hash,
    status: 'draft',
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt: '2026-10-27T09:00:00Z',
    generator: { kind: 'agent', name: 'Hostile agent' },
    ...(sample.state ? { state: sample.state } : {}),
    tree: sample.make ? sample.make() : sample.tree,
  };
}

describe('hostile spec 0.3.0 blueprints', () => {
  it('covers the required categories', () => {
    const categories = new Set(HOSTILE_BLUEPRINTS.map((sample) => sample.category));
    for (const category of [
      'workflow-cycle',
      'workflow-size',
      'bidi',
      'script-url',
      'reorder',
      'unknown-id',
      'unknown-prop',
      'unknown-action',
      'binding',
      'prototype',
    ]) {
      expect(categories.has(category as never), category).toBe(true);
    }
  });

  for (const sample of HOSTILE_BLUEPRINTS) {
    it(`${sample.id}: ${sample.refuse.length ? `refused (${sample.refuse.join(' or ')})` : 'neutralized'}`, () => {
      const started = performance.now();
      const result = validateDraft(envelope(sample), {
        catalog,
        catalogHash: build.hash,
        tier: 'untrusted',
        frameRoots: false,
        checkSpec: (value) => validateBlueprint(value, documents, { catalogHash: build.hash }),
      });
      expect(performance.now() - started).toBeLessThan(2000);
      expect(assertInertRoots(result.roots)).toEqual([]);
      if (sample.refuse.length === 0) {
        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        return;
      }
      expect(result.ok).toBe(false);
      const codes = result.diagnostics.filter((d) => d.severity === 'error').map((d) => d.code);
      expect(
        sample.refuse.some((code) => codes.includes(code)),
        `${sample.id}: ${JSON.stringify(codes)}`
      ).toBe(true);
      // Refused input never earns the validated status.
      expect(result.envelope?.status ?? 'draft').toBe('draft');
    });
  }
});

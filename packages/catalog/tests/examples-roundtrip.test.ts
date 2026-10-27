// @vitest-environment node
import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import { type Schema, validateBlueprint } from '@texuli/spec';
import { checkCatalogContract, projectCatalog } from '@texuli/spec/codegen';
import { validateWorkflowGraph } from '@texuli/spec/workflow';
import { describe, expect, it } from 'vitest';
import blueprintJson from '../../spec/schemas/blueprint.schema.json';
import workflowJson from '../../spec/schemas/workflow.schema.json';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { blueprintDigest } from '../src/edit/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import type { CatalogTreeInput } from '../src/render/renderer/types.ts';
import { createFamilyBlockCheck, diagramFamilyCheck } from '../src/validate/blocks.ts';
import { validateDraft } from '../src/validate/index.ts';

/**
 * Every manifest example is a blueprint that must validate (the catalog's
 * own checks and the full spec 0.3.0 check against the live catalog's
 * projection), hash stably, and render to its component (not a
 * placeholder). The player paints the same examples in happy-dom
 * (packages/player/tests).
 */

const build = await buildCatalog(await discoverManifestGroups());
const developer = renderCatalogFromBuild(build.catalog, { developer: 'all' });
// Every family's own parser, as the player injects them.
const checkBlock = createFamilyBlockCheck({
  'blocks-code': checkCodeBlock,
  'blocks-data': checkDataBlock,
  'blocks-diagram': diagramFamilyCheck,
  'blocks-embed': checkEmbedBlock,
  'blocks-interactive': checkInteractiveBlock,
  'blocks-map': checkMapBlock,
  'blocks-media': checkMediaBlock,
  'blocks-structure': checkStructureBlock,
  'blocks-text': checkTextBlock,
});
const vocabulary = projectCatalog(build.catalog, build.hash);
const documents = {
  blueprintSchema: blueprintJson as unknown as Schema,
  catalog: vocabulary,
  workflowSchema: workflowJson as unknown as Schema,
  validateWorkflowGraph,
};

/** `$state` names an example reads; declared as lists (only `reorder` binds in examples). */
function stateNames(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) stateNames(item, out);
  else if (value && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    if (typeof bag.$state === 'string') out.add(bag.$state);
    for (const entry of Object.values(bag)) stateNames(entry, out);
  }
  return out;
}

function envelopeFor(id: string, example: string, props: Readonly<Record<string, unknown>>) {
  const names = [...stateNames(props)];
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: `example-${id}-${example}`,
    catalog: build.hash,
    status: 'draft',
    createdAt: '2026-10-27T09:00:00Z',
    updatedAt: '2026-10-27T09:00:00Z',
    generator: { kind: 'tool', name: 'examples round-trip' },
    spec: '0.3.0',
    ...(names.length > 0
      ? { state: Object.fromEntries(names.map((name) => [name, { type: 'list', maxItems: 50 }])) }
      : {}),
    tree: { id, props },
  };
}

const cases = build.catalog.entries.flatMap((entry) =>
  entry.examples.map((example) => ({ entry, example }))
);

describe('manifest examples round-trip', () => {
  it('the projected vocabulary passes the spec contract checks (schemas, bindable, events)', () => {
    expect(checkCatalogContract(vocabulary)).toEqual([]);
  });

  it('covers every example of every manifest', () => {
    expect(cases.length).toBeGreaterThan(150);
    for (const entry of build.catalog.entries.filter((e) => e.agentEmittable)) {
      expect(entry.examples.length, entry.id).toBeGreaterThan(0);
    }
  });

  for (const { entry, example } of cases) {
    it(`${entry.id} / ${example.id}: validates, hashes stably and renders`, async () => {
      const envelope = envelopeFor(entry.id, example.id, example.props);
      const tier = entry.emit.includes('untrusted') ? 'untrusted' : 'developer';
      const result = validateDraft(envelope, {
        catalog: developer,
        catalogHash: build.hash,
        tier,
        frameRoots: false,
        checkBlock,
        checkSpec: (value) => validateBlueprint(value, documents, { catalogHash: build.hash }),
      });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors, JSON.stringify(errors)).toEqual([]);
      expect(result.checks.spec).toBe('pass');
      expect(result.roots[0]).toMatchObject({ kind: 'component', id: entry.id });

      const draft = result.draft as CatalogTreeInput;
      const digest = await blueprintDigest(draft);
      expect(await blueprintDigest(JSON.parse(JSON.stringify(draft)))).toBe(digest);
      const reversed = { props: draft.props, id: draft.id } as CatalogTreeInput;
      expect(await blueprintDigest(reversed)).toBe(digest);
    });
  }
});

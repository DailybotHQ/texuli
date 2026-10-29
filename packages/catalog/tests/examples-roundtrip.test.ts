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
import { checkFormDraft } from '../../forms/src/model/index.ts';
import blueprintJson from '../../spec/schemas/blueprint.schema.json';
import workflowJson from '../../spec/schemas/workflow.schema.json';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { blueprintDigest } from '../src/edit/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import type { CatalogTreeInput } from '../src/render/renderer/types.ts';
import { createFamilyBlockCheck, diagramFamilyCheck } from '../src/validate/blocks.ts';
import { validateDraft } from '../src/validate/index.ts';
import { checkCanvas } from './canvas-check.ts';
import { checkDocument } from './document-check.ts';

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

/** The state type each control example writes, declared under its `state` name. */
const CONTROL_TYPES: Readonly<Record<string, Record<string, unknown>>> = {
  'control-toggle': { type: 'boolean' },
  'control-choice': { type: 'enum', values: ['this-week', 'last-week'] },
  'control-slider': { type: 'number', min: 0, max: 10 },
  'control-filter': { type: 'string' },
};

/** Fields and submits sit in a form (the state surface rule); examples are fragments. */
const IN_FORM = new Set(['form-field', 'form-submit']);

/**
 * An example as a valid blueprint: the `$state` lists it reads, the variable a
 * control or field writes, a flow for flow nodes, and a form around fields.
 */
function envelopeFor(id: string, example: string, props: Readonly<Record<string, unknown>>) {
  const state: Record<string, unknown> = Object.fromEntries(
    [...stateNames(props)].map((name) => [name, { type: 'list', maxItems: 50 }])
  );
  const name = typeof props.state === 'string' ? props.state : undefined;
  const control = CONTROL_TYPES[id];
  if (name && control) state[name] = control;
  if (name && id === 'form-field')
    state[name] =
      props.kind === 'number' ? { type: 'number', min: 0, max: 100 } : { type: 'string' };
  const flow =
    id === 'flow-view'
      ? { views: [props.name], initial: props.name, transitions: [] }
      : id === 'flow-action'
        ? {
            views: ['start', 'end'],
            initial: 'start',
            transitions: [{ from: 'start', to: 'end', on: props.event }],
          }
        : undefined;
  const node = { id, props };
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
    ...(Object.keys(state).length > 0 ? { state } : {}),
    ...(flow ? { flow } : {}),
    tree: IN_FORM.has(id)
      ? {
          id: 'action-form',
          props: { action: 'send-request', label: 'Send request' },
          children: [node],
        }
      : node,
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
        checkDocument,
        checkCanvas,
        checkForm: checkFormDraft,
        checkSpec: (value) => validateBlueprint(value, documents, { catalogHash: build.hash }),
      });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors, JSON.stringify(errors)).toEqual([]);
      expect(result.checks.spec).toBe('pass');
      const wrapped = IN_FORM.has(entry.id);
      expect(result.roots[0]).toMatchObject({
        kind: 'component',
        id: wrapped ? 'action-form' : entry.id,
      });

      const root = result.draft as CatalogTreeInput;
      const draft = (wrapped ? root.children?.[0] : root) as CatalogTreeInput;
      expect(draft.id).toBe(entry.id);
      const digest = await blueprintDigest(draft);
      expect(await blueprintDigest(JSON.parse(JSON.stringify(draft)))).toBe(digest);
      const reversed = { props: draft.props, id: draft.id } as CatalogTreeInput;
      expect(await blueprintDigest(reversed)).toBe(digest);
    });
  }
});

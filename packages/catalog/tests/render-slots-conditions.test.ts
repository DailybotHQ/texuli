// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { isTreeNode } from '../src/edit/parse.ts';
import { createPlayer } from '../src/player/index.ts';
import { formulaConditions } from '../src/render/conditions/index.ts';
import { measureCatalogTree } from '../src/render/limits/index.ts';
import {
  type CatalogTreeInput,
  type RenderNode,
  renderCatalogFromBuild,
  renderCatalogTree,
} from '../src/render/renderer/index.ts';
import { validateDraft } from '../src/validate/index.ts';

/**
 * Catalog expressiveness follow-up, audit gaps G04 (named slots are
 * addressable: a child names its parent's `slot` prop) and G07 (conditional
 * regions: a `when` condition in the blocks `Condition` AST).
 */

const build = await buildCatalog(await discoverManifestGroups());
// layout-marketing and dialog are app chrome: the host admits them.
const chrome = renderCatalogFromBuild(build.catalog, { developer: 'all' });
const normative = renderCatalogFromBuild(build.catalog);

type Component = Extract<RenderNode, { kind: 'component' }>;

const heading = (text: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'heading', level: 2, text } },
});
const paragraph = (text: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown: text } },
});
const totalAbove = (value: number) => ({
  op: 'gt',
  left: { op: 'var', name: 'total' },
  right: { op: 'num', value },
});

function codes(result: { diagnostics: readonly { code: string }[] }): string[] {
  return result.diagnostics.map((d) => d.code);
}

describe('G04: slot-addressed children', () => {
  const page = {
    id: 'layout-marketing',
    props: {},
    children: [
      { ...heading('Harbor Notes'), slot: 'hero' },
      { ...paragraph('Plan the week.'), slot: 'sections' },
      { ...paragraph('Made by a fictional team.'), slot: 'footer' },
      { ...paragraph('Default slot'), slot: 'children' },
    ],
  };

  it('G04: slots route children, refuse bad slots, keep the tier contract and limits, and survive every stage', () => {
    // routes each child to the named slot it asks for
    {
      const result = renderCatalogTree(page, { catalog: chrome, tier: 'developer' });
      expect(result.diagnostics).toEqual([]);
      const root = result.roots[0] as Component;
      expect(root.children.map((c) => c.slot)).toEqual(['hero', 'sections', 'footer', undefined]);
      // The default slot is an ordinary child: no slot field at all.
      expect(Object.hasOwn(root.children[3] as object, 'slot')).toBe(false);
    }
    for (const slot of ['sidebar', 'title', 3]) {
      const result = renderCatalogTree(
        { id: 'dialog', props: { title: 'Edit note' }, children: [{ ...paragraph('x'), slot }] },
        { catalog: chrome, tier: 'developer' }
      );
      expect((result.roots[0] as Component).children).toEqual([]);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'invalid-slot', path: '0.children.0' }),
      ]);
      expect(result.diagnostics[0]?.message).toContain('trigger, footer, children');
    }
    // ignores a slot on a root node and keeps the node
    {
      const result = renderCatalogTree(
        { ...heading('Root'), slot: 'hero' },
        { catalog: normative, tier: 'untrusted' }
      );
      expect(result.roots[0]).toMatchObject({ kind: 'component', id: 'blocks-text' });
      expect(Object.hasOwn(result.roots[0] as object, 'slot')).toBe(false);
      expect(codes(result)).toEqual(['invalid-slot']);
    }
    // keeps the tier contract inside a slot: a denied child is a slotted placeholder
    {
      const result = renderCatalogTree(
        {
          id: 'layout-card',
          props: { title: 'Summary' },
          children: [{ id: 'dialog', props: { title: 'Delete?' }, slot: 'children' }],
        },
        { catalog: normative, tier: 'untrusted' }
      );
      expect((result.roots[0] as Component).children[0]).toMatchObject({
        kind: 'placeholder',
        reason: 'tier-denied',
      });
      const slotted = renderCatalogTree(
        {
          id: 'dialog',
          props: { title: 'Edit note' },
          children: [{ id: 'not-a-component', slot: 'footer' }],
        },
        { catalog: chrome, tier: 'developer' }
      );
      expect((slotted.roots[0] as Component).children[0]).toMatchObject({
        kind: 'placeholder',
        reason: 'unknown-id',
        slot: 'footer',
      });
    }
    // counts slotted children against the tree limits like any child
    {
      const measured = measureCatalogTree(page);
      expect(measured.metrics.nodes).toBe(5);
    }
    // survives validateDraft, the edit shape check and the paint plan
    {
      const validation = validateDraft(page, {
        catalog: chrome,
        tier: 'developer',
        frameRoots: false,
      });
      expect(validation.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect((validation.draft as CatalogTreeInput).children?.map((c) => c.slot)).toEqual([
        'hero',
        'sections',
        'footer',
        'children',
      ]);
      expect(isTreeNode(page)).toBe(true);
      expect(isTreeNode({ id: 'layout-card', slot: 1 })).toBe(false);
      const player = createPlayer({
        blueprint: page,
        catalog: chrome,
        tier: 'developer',
        frameRoots: false,
      });
      const plan = player.state.plan[0] as Extract<RenderNode, { kind: 'component' }>;
      expect(plan.children.map((c) => c.slot)).toEqual(['hero', 'sections', 'footer', undefined]);
    }
  });
});

describe('G07: conditional regions', () => {
  const report = (when: unknown, child = paragraph('Totals are above zero.')) => ({
    id: 'layout-doc',
    props: { title: 'Weekly report' },
    children: [heading('Summary'), { ...child, when }],
  });
  const render = (tree: unknown, conditionInputs?: Record<string, number | null>) =>
    renderCatalogTree(tree, {
      catalog: normative,
      tier: 'untrusted',
      conditions: formulaConditions,
      ...(conditionInputs ? { conditionInputs } : {}),
    });

  it('G07: conditions show, hide, still check, refuse malformed conditions and fail closed without a runtime', () => {
    // shows the region when the condition holds for the host inputs
    {
      const result = render(report(totalAbove(0)), { total: 5 });
      expect(result.diagnostics).toEqual([]);
      expect((result.roots[0] as Component).children).toHaveLength(2);
    }
    for (const inputs of [{ total: 0 }, undefined, { total: null }]) {
      const result = render(report(totalAbove(0)), inputs);
      expect(result.diagnostics, JSON.stringify(inputs)).toEqual([]);
      expect((result.roots[0] as Component).children, JSON.stringify(inputs)).toHaveLength(1);
    }
    // still checks a hidden region: its diagnostics stand
    {
      const hidden = { id: 'not-a-component' };
      const result = render(report(totalAbove(0), hidden as never), { total: 0 });
      expect((result.roots[0] as Component).children).toHaveLength(1);
      expect(codes(result)).toEqual(['unknown-id']);
    }
    for (const [label, when] of BAD_CONDITIONS) {
      const result = render(report(when), { total: 5 });
      expect((result.roots[0] as Component).children, label).toHaveLength(1);
      expect(codes(result), label).toEqual(['invalid-condition']);
    }
    // fails closed without a condition runtime
    {
      const result = renderCatalogTree(report(totalAbove(0)), {
        catalog: normative,
        tier: 'untrusted',
        conditionInputs: { total: 5 },
      });
      expect((result.roots[0] as Component).children).toHaveLength(1);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({ code: 'invalid-condition', path: '0.children.1' }),
      ]);
    }
    // ignores a condition on a root node and keeps the root
    {
      const result = render({ ...heading('Root'), when: totalAbove(0) }, { total: 0 });
      expect(result.roots).toHaveLength(1);
      expect(codes(result)).toEqual(['invalid-condition']);
    }
    // is an error in validateDraft without a runtime, and valid with one
    {
      const tree = report(totalAbove(0));
      expect(validateDraft(tree, { catalog: normative }).ok).toBe(false);
      const ok = validateDraft(tree, {
        catalog: normative,
        conditions: formulaConditions,
        conditionInputs: { total: 1 },
      });
      expect(ok.ok).toBe(true);
      expect((ok.draft as CatalogTreeInput).children?.[1]?.when).toEqual(totalAbove(0));
      expect(isTreeNode(tree)).toBe(true);
    }
    // re-evaluates in the player when the host updates its inputs
    {
      const player = createPlayer({
        blueprint: report(totalAbove(0)),
        catalog: normative,
        conditions: formulaConditions,
        conditionInputs: { total: 0 },
      });
      const count = () => (player.state.plan[0] as Component).children.length;
      expect(count()).toBe(1);
      player.update({ conditionInputs: { total: 3 } });
      expect(count()).toBe(2);
      player.dispose();
    }
  });

  const BAD_CONDITIONS: ReadonlyArray<[string, unknown]> = [
    ['an unknown op', { op: 'exec', value: 'rm' }],
    ['a number formula, not a condition', { op: 'num', value: 1 }],
    ['a string', 'total > 0'],
    [
      'an unsafe variable name',
      { op: 'gt', left: { op: 'var', name: 'constructor' }, right: { op: 'num', value: 0 } },
    ],
  ];
});

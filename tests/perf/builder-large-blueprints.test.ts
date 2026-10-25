import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { createBuilderUndo } from '../../apps/website/src/components/builder/history/model.ts';
import { BUILDER_MANIFEST_BY_ID } from '../../apps/website/src/components/builder/manifest.ts';
import {
  canonicalJson,
  createBuilderHistory,
  flattenTree,
  validateBuilderTree,
} from '../../apps/website/src/components/builder/model.ts';
import { moveKeepsStructure } from '../../apps/website/src/components/builder/outline/guard.ts';
import {
  keyboardMove,
  manifestCanContain,
  outlineRows,
} from '../../apps/website/src/components/builder/outline/model.ts';
import {
  checkPayloadText,
  prettyBlueprintJson,
} from '../../apps/website/src/components/builder/payload/model.ts';
import { blueprintDigest } from '../../packages/catalog/src/edit/digest.ts';
import type { CatalogTreeInput } from '../../packages/catalog/src/render/renderer/types.ts';
import { mountPlayer, PLAYER_LOADERS } from '../../packages/player/src/index.ts';

declare const process: { env: Record<string, string | undefined> };

/*
 * The blueprint builder at scale (texuli.com/builder): synthetic blueprints
 * of 100, 500 and 512 nodes (512 is the catalog tree limit, `maxNodes`) and a
 * chain at the depth limit (16), through every path one edit runs: flatten
 * for the inspector, outline rows, a history apply with its commit gate, a
 * coalesced typing burst, canonical JSON, the payload panel's pretty text,
 * digest and commit check, the outline move guard, and a live update of the
 * mounted player (R20). 1000 nodes is past the limit, so the builder refuses
 * it; only the pure walks are measured there. Same shape as the other perf
 * files: best of three after a warm-up, budgets calibrated against a native
 * 100k sort on the same machine.
 */

function createRng(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function bestOfThree(work: () => unknown): number {
  work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

async function bestOfThreeAsync(work: () => Promise<unknown>): Promise<number> {
  await work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    await work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

const random = createRng('builder-large-blueprints');
const baselineMs = bestOfThree(() => Float64Array.from({ length: 100_000 }, random).sort());
const budget = (floorMs: number, factor: number) => Math.max(floorMs, factor * baselineMs);
const report = (name: string, ms: number) => {
  if (process.env.TEXULI_PERF_REPORT === '1') {
    console.log(`[perf] ${name}: ${ms.toFixed(2)} ms (baseline ${baselineMs.toFixed(1)} ms)`);
  }
};

const leaf = (index: number): CatalogTreeInput =>
  index % 2 === 0
    ? {
        id: 'blocks-text',
        props: { block: { type: 'text', markdown: `Fictional paragraph ${index}.` } },
      }
    : { id: 'charts-gauge', props: { label: `Gauge ${index}`, value: index % 100 } };

/** A page of cards holding leaves: `nodes` in all, at most 64 children per node. */
function wideBlueprint(nodes: number): CatalogTreeInput {
  const cards: CatalogTreeInput[] = [];
  let left = nodes - 1;
  let index = 0;
  while (left > 0) {
    const card: CatalogTreeInput = {
      id: 'layout-card',
      props: { title: `Card ${index}` },
      children: [],
    };
    left -= 1;
    const take = Math.min(left, 15);
    for (let i = 0; i < take; i += 1) card.children?.push(leaf(index++));
    left -= take;
    cards.push(card);
  }
  return { id: 'layout-page', props: { title: 'Fictional large page' }, children: cards };
}

/** Cards nested to the depth limit, each with leaves, `nodes` in all. */
function deepBlueprint(nodes: number, depth = 16): CatalogTreeInput {
  const perLevel = Math.max(0, Math.floor((nodes - depth) / (depth - 1)));
  let index = 0;
  const level = (remaining: number): CatalogTreeInput => {
    if (remaining === 1) return leaf(index++);
    const children: CatalogTreeInput[] = [];
    for (let i = 0; i < perLevel; i += 1) children.push(leaf(index++));
    children.push(level(remaining - 1));
    return { id: 'layout-card', props: { title: `Level ${remaining}` }, children };
  };
  return {
    id: 'layout-page',
    props: { title: 'Fictional deep page' },
    children: [level(depth - 1)],
  };
}

const countNodes = (node: CatalogTreeInput): number =>
  1 + (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);
const depthOf = (node: CatalogTreeInput): number =>
  1 + Math.max(0, ...(node.children ?? []).map(depthOf));

/** The path of the last gauge in reading order: the deepest edit target with a `label`. */
const lastPath = (tree: CatalogTreeInput) =>
  flattenTree(tree).findLast((entry) => entry.node.id === 'charts-gauge')?.path ?? [];

const labelOf = (id: string) => BUILDER_MANIFEST_BY_ID.get(id)?.label ?? id;
const canContain = (id: string) => {
  const manifest = BUILDER_MANIFEST_BY_ID.get(id);
  return manifest ? manifestCanContain(manifest) : false;
};

const SHAPES = [
  ['wide-100', wideBlueprint(100)],
  ['wide-500', wideBlueprint(500)],
  ['wide-512', wideBlueprint(512)],
  ['deep-512', deepBlueprint(512)],
] as const;

describe('builder blueprints at scale', () => {
  it('builds valid blueprints at the catalog limits', () => {
    for (const [name, tree] of SHAPES) {
      expect(validateBuilderTree(tree), name).toBe(true);
    }
    expect(countNodes(wideBlueprint(512))).toBe(512);
    expect(countNodes(deepBlueprint(512))).toBeLessThanOrEqual(512);
    expect(depthOf(deepBlueprint(512))).toBe(16);
    // Past the node limit: the builder refuses the tree outright.
    expect(validateBuilderTree(wideBlueprint(1000))).toBe(false);
  });

  it('per-edit walks: flatten, outline rows, canonical and pretty JSON', {
    timeout: 60_000,
  }, () => {
    for (const [name, tree] of [...SHAPES, ['wide-1000', wideBlueprint(1000)] as const]) {
      const flat = bestOfThree(() => flattenTree(tree));
      const rows = bestOfThree(() => outlineRows(tree, labelOf, canContain));
      const json = bestOfThree(() => canonicalJson(tree));
      const pretty = bestOfThree(() => prettyBlueprintJson(tree));
      report(`${name} flatten`, flat);
      report(`${name} outline rows`, rows);
      report(`${name} canonical JSON`, json);
      report(`${name} payload pretty JSON`, pretty);
      expect(flattenTree(tree)).toHaveLength(countNodes(tree));
      expect(flat).toBeLessThan(budget(10, 2));
      expect(rows).toBeLessThan(budget(10, 2));
      expect(json).toBeLessThan(budget(30, 5));
      expect(pretty).toBeLessThan(budget(40, 6));
    }
  });

  it('one keystroke: a history apply with the commit gate, deepest node', {
    timeout: 60_000,
  }, () => {
    for (const [name, tree] of SHAPES) {
      const path = lastPath(tree);
      let n = 0;
      const ms = bestOfThree(() => {
        const history = createBuilderUndo(createBuilderHistory(tree), labelOf);
        const result = history.apply({ op: 'setProp', path, name: 'label', value: `x${n++}` });
        if (!result.ok) throw new Error(result.error.message);
      });
      report(`${name} history apply`, ms);
      expect(ms).toBeLessThan(budget(20, 3));
    }
  });

  it('a typing burst coalesces in linear time', { timeout: 120_000 }, () => {
    const tree = wideBlueprint(512);
    const path = lastPath(tree);
    const history = createBuilderUndo(createBuilderHistory(tree), labelOf);
    const chunk = (from: number, count: number) => {
      const started = performance.now();
      for (let i = from; i < from + count; i += 1) {
        const result = history.apply(
          { op: 'setProp', path, name: 'label', value: `Gauge ${'x'.repeat(i % 40)}` },
          { coalesceKey: 'prop:typing' }
        );
        if (!result.ok) throw new Error(result.error.message);
      }
      return performance.now() - started;
    };
    chunk(0, 50);
    const first = chunk(50, 500);
    chunk(550, 1_950);
    const last = chunk(2_500, 500);
    report('wide-512 typing burst, keystrokes 50-550', first);
    report('wide-512 typing burst, keystrokes 2500-3000', last);
    // One coalesced step: undo goes back to before the burst.
    expect(history.undo()?.tree).toBe(tree);
    // Linear: the last 500 keystrokes cost about what the first 500 did.
    expect(last).toBeLessThan(Math.max(first * 2.5, budget(50, 5)));
  });

  it('payload panel: digest and commit check of the whole text', { timeout: 60_000 }, async () => {
    for (const [name, tree] of SHAPES) {
      const text = prettyBlueprintJson(tree);
      const digest = await bestOfThreeAsync(() => blueprintDigest(tree));
      const check = bestOfThree(() => checkPayloadText(text));
      report(`${name} digest`, digest);
      report(`${name} commit check (${Math.round(text.length / 1024)} KB)`, check);
      expect(checkPayloadText(text).ok).toBe(true);
      expect(digest).toBeLessThan(budget(40, 6));
      expect(check).toBeLessThan(budget(60, 8));
    }
  });

  it('payload panel: a refused text with an issue on every node is placed in linear time', {
    timeout: 60_000,
  }, () => {
    const tree = wideBlueprint(512);
    const bad = (node: CatalogTreeInput): CatalogTreeInput => ({
      ...node,
      props: { ...node.props, nope: 1 },
      ...(node.children ? { children: node.children.map(bad) } : {}),
    });
    const text = JSON.stringify(bad(tree), null, 2);
    const result = checkPayloadText(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(512);
      expect(result.issues.every((issue) => issue.at !== undefined)).toBe(true);
    }
    const ms = bestOfThree(() => checkPayloadText(text));
    report(`wide-512 commit check, 512 placed issues (${Math.round(text.length / 1024)} KB)`, ms);
    expect(ms).toBeLessThan(budget(60, 8));
    // Placing an issue per node costs about what the clean check of the same tree does
    // (a rescan per issue made it 15× slower).
    const clean = bestOfThree(() => checkPayloadText(prettyBlueprintJson(tree)));
    expect(ms).toBeLessThan(Math.max(clean * 4, 10));
  });

  it('outline move: the structural guard on both trees', { timeout: 60_000 }, () => {
    for (const [name, tree] of SHAPES) {
      const path = lastPath(tree);
      const move = (['up', 'down', 'outdent'] as const)
        .map((intent) => keyboardMove(tree, path, intent, canContain))
        .find((candidate) => candidate.ok);
      if (!move?.ok) throw new Error(`${name}: no move for the last gauge`);
      const history = createBuilderHistory(tree);
      const next = history.apply(move.op);
      if (!next.ok) throw new Error(next.error.message);
      const ms = bestOfThree(() => moveKeepsStructure(tree, next.tree));
      report(`${name} move guard`, ms);
      expect(moveKeepsStructure(tree, next.tree)).toBe(true);
      expect(ms).toBeLessThan(budget(80, 10));
    }
  });

  it('preview: a live update of the mounted player repaints one edit', {
    timeout: 120_000,
  }, async () => {
    for (const [name, tree] of SHAPES) {
      const target = document.createElement('div');
      document.body.append(target);
      const path = lastPath(tree);
      const history = createBuilderHistory(tree);
      const mounted = mountPlayer(target, {
        blueprint: tree,
        tier: 'untrusted',
        status: 'draft',
        invalidPolicy: 'preview',
        landmarks: false,
        loaders: PLAYER_LOADERS,
      });
      const painted = async (text: string) => {
        for (let i = 0; i < 2_000 && !target.textContent?.includes(text); i += 1) {
          await tick();
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (!target.textContent?.includes(text))
          throw new Error(`${name}: "${text}" never painted`);
      };
      const first = performance.now();
      await painted('Fictional paragraph 0.');
      const mountMs = performance.now() - first;
      let n = 0;
      const ms = await bestOfThreeAsync(async () => {
        const label = `Edited gauge ${n++}`;
        const next = history.apply({ op: 'setProp', path, name: 'label', value: label });
        if (!next.ok) throw new Error(next.error.message);
        mounted.update({ blueprint: next.tree });
        await painted(label);
      });
      report(`${name} preview first paint`, mountMs);
      report(`${name} preview live update`, ms);
      mounted.dispose();
      target.remove();
      expect(ms).toBeLessThan(budget(400, 40));
    }
  });
});

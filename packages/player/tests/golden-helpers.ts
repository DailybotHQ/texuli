import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPlayer, type PaintAdapter } from '@texuli/catalog/player';
import { checkFamilyBlock } from '../src/block-check.ts';
import { createPlayerCatalog } from '../src/catalog.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';

/**
 * Shared plumbing for the golden fixture paint tests. Fixtures and pinned
 * numbers are read from tests/fixtures/golden on disk, the files the golden
 * runner and the catalog gate enforce; the player tests never re-pin them.
 */

export type Tier = 'untrusted' | 'developer';
export type TreeNode = { id: string; props?: Record<string, unknown>; children?: TreeNode[] };

export interface GoldenFixture {
  tier: Tier;
  frame?: { label: string; source: string } | null;
  tree: TreeNode;
}

export interface GoldenExpectation {
  tier: string;
  nodes: number;
  components: number;
  placeholders: number;
  cross: { tier: Tier; placeholders: number };
  frame: { ok: boolean; label: string; badge: string } | null;
}

// Vitest runs from the repository root.
function golden(file: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/golden', file), 'utf8'));
}

export function loadGolden(file: string, name: string) {
  const fixture = golden(file) as GoldenFixture;
  const expectations = golden('golden-expectations.json') as {
    fixtures: Record<string, GoldenExpectation>;
  };
  const expected = expectations.fixtures[name];
  if (!expected) throw new Error(`No golden expectation for ${name}.`);
  return { fixture, expected };
}

export type Painted = { kind: 'component' | 'placeholder'; id: string; children: Painted[] };

export function idTree(node: TreeNode): unknown {
  return { id: node.id, children: (node.children ?? []).map(idTree) };
}

export function paintedIds(node: Painted): unknown {
  return { id: node.id, children: node.children.map(paintedIds) };
}

export function count(nodes: readonly Painted[], kind: Painted['kind']): number {
  return nodes.reduce(
    (sum, node) => sum + (node.kind === kind ? 1 : 0) + count(node.children, kind),
    0
  );
}

export function countInput(node: TreeNode): number {
  return 1 + (node.children ?? []).reduce((sum, child) => sum + countInput(child), 0);
}

const adapter: PaintAdapter<Painted> = {
  component: (node, _component, children) => ({
    kind: 'component',
    id: node.id,
    children: [...children],
  }),
  placeholder: (node) => ({ kind: 'placeholder', id: node.id, children: [] }),
  skeleton: (node) => ({ kind: 'placeholder', id: node.id, children: [] }),
};

/** Paint a tree through the framework-free core with the player's catalog, block check and real loaders. */
export async function paintCore(tree: TreeNode, tier: Tier) {
  const handle = createPlayer({
    blueprint: tree,
    catalog: createPlayerCatalog(),
    tier,
    checkBlock: checkFamilyBlock,
    loaders: PLAYER_LOADERS,
  });
  const painted = await handle.paint(adapter);
  const state = handle.state;
  handle.dispose();
  return { painted, state };
}

/** A frame's accessible name: the heading its `aria-labelledby` names, else its tag. */
export function frameName(frame: Element): string {
  const labelledBy = frame.getAttribute('aria-labelledby');
  return labelledBy
    ? (frame.ownerDocument.getElementById(labelledBy)?.textContent ?? '')
    : frame.tagName;
}

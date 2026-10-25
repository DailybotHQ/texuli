// @vitest-environment node

import type { CatalogPropSchema } from '@texuli/catalog';
import {
  applyEditOp,
  applyEditOps,
  blueprintDigest,
  canonicalBlueprintJson,
  type EditOp,
} from '@texuli/catalog/edit';
import { createPlayer } from '@texuli/catalog/player';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import {
  enumInput,
  isChoiceProp,
  readChoice,
  switchChecked,
} from '../../apps/website/src/components/builder/inspector/choice/model.ts';
import {
  isNumberProp,
  parseNumberInput,
  readNumber,
} from '../../apps/website/src/components/builder/inspector/number/model.ts';
import {
  editableBlock,
  HEADING_LEVELS,
  isTextType,
  setField,
  switchType,
  TEXT_TYPES,
  type TextBlockValue,
} from '../../apps/website/src/components/builder/inspector/text/model.ts';
import { BUILDER_MANIFEST_BY_ID } from '../../apps/website/src/components/builder/manifest.ts';
import {
  createBuilderHistory,
  validateBuilderTree,
} from '../../apps/website/src/components/builder/model.ts';
import {
  blockIds,
  copySubtrees,
  duplicateOps,
  groupDropMove,
  groupKeyboardMove,
  groupRemoveOps,
  pasteOps,
} from '../../apps/website/src/components/builder/outline/group.ts';
import { moveKeepsStructure } from '../../apps/website/src/components/builder/outline/guard.ts';
import {
  type DropPosition,
  keyboardMove,
  type MoveIntent,
  manifestCanContain,
  nodeAt,
  outlineRows,
} from '../../apps/website/src/components/builder/outline/model.ts';
import {
  builderTreeIssues,
  checkPayloadText,
  prettyBlueprintJson,
} from '../../apps/website/src/components/builder/payload/model.ts';
// scripts/tests resolve from the root, which does not depend on @texuli/player.
import { createPlayerCatalog } from '../../packages/player/src/catalog.ts';

/**
 * Task 72, the round-trip property (builder design §6.2, §12): seeded,
 * deterministic sequences of structured edits (palette inserts, outline
 * moves and removals, inspector writes, undo) and JSON commits (valid and
 * hostile) drive the builder's own models. After every step:
 * - the closed rules accept the tree (no sequence escapes them);
 * - the payload text reads back to the same canonical JSON, idempotently;
 * - the player re-reads the same tree, and its digest equals the builder's
 *   whenever the draft validates;
 * - the outline rows rebuild the same structure;
 * - every inspector field reads and writes back its value unchanged;
 * - a refused step leaves the tree untouched;
 * - no block id repeats (duplicates and pastes always take fresh ones).
 * PLAN_005 task 4 adds the outline's group moves and drops, group delete,
 * duplicate and paste, through the same guard the outline applies.
 * A failure message names the seed and the steps, so it replays exactly.
 */

const SEEDS = 32;
const STEPS = 24;

/** mulberry32: a small, well-known 32-bit seeded generator. */
function generator(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (max: number) => Math.floor(next() * max);
  return {
    int,
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]): T => items[int(items.length)] as T,
  };
}
type Rng = ReturnType<typeof generator>;

const WORDS = ['Harbor', 'North', 'Pier', 'Weekly', 'Ledger', 'Atlas', 'Summary', 'Fictional'];
const phrase = (rng: Rng) =>
  `${rng.pick(WORDS)} ${rng.pick(WORDS).toLowerCase()} ${1 + rng.int(99)}`;

function textBlock(rng: Rng): TextBlockValue {
  const type = rng.pick(TEXT_TYPES);
  let block = switchType(editableBlock(undefined), type);
  if (type === 'heading') {
    block = setField(setField(block, 'level', rng.pick(HEADING_LEVELS)), 'text', phrase(rng));
  } else if (type === 'text') block = setField(block, 'markdown', `${phrase(rng)}.`);
  else if (type === 'quote') block = setField(block, 'quote', `${phrase(rng)}.`);
  else if (type === 'callout') block = setField(block, 'body', `${phrase(rng)}.`);
  return block;
}

/** Palette inserts: valid props for each id the generator places. */
/** Block ids for inserted text blocks: unique per seed, so a repeat can only come from a copy. */
let blockSerial = 0;
const INSERTS: Readonly<Record<string, (rng: Rng) => Record<string, unknown>>> = {
  'blocks-text': (rng) => {
    if (!rng.chance(0.5)) return { block: textBlock(rng) };
    blockSerial += 1;
    return { block: { ...textBlock(rng), id: `b${blockSerial}` } };
  },
  'layout-card': (rng) => (rng.chance(0.7) ? { title: phrase(rng) } : {}),
  'layout-grid': () => ({}),
  'charts-gauge': (rng) => ({ label: phrase(rng), value: rng.int(101) }),
};

const catalog = createPlayerCatalog();
const canContain = (id: string) => {
  const manifest = BUILDER_MANIFEST_BY_ID.get(id);
  return manifest ? manifestCanContain(manifest) : false;
};
const canonical = (tree: unknown) => canonicalBlueprintJson(tree as CatalogTreeInput);

function nodes(tree: CatalogTreeInput): { node: CatalogTreeInput; path: number[] }[] {
  const out: { node: CatalogTreeInput; path: number[] }[] = [];
  const visit = (node: CatalogTreeInput, path: number[]) => {
    out.push({ node, path });
    node.children?.forEach((child, index) => {
      visit(child, [...path, index]);
    });
  };
  visit(tree, []);
  return out;
}

/** The structure the outline rows describe, rebuilt from the rows alone. */
function treeFromRows(tree: CatalogTreeInput): unknown {
  const rows = outlineRows(tree, (id) => id, canContain);
  const built = new Map<string, { id: string; children: unknown[] }>();
  for (const row of rows) {
    const node = { id: row.id, children: [] as unknown[] };
    built.set(row.key, node);
    if (row.path.length > 0) built.get(row.path.slice(0, -1).join('.'))?.children.push(node);
  }
  return built.get('');
}
const skeleton = (node: CatalogTreeInput): unknown => ({
  id: node.id,
  children: (node.children ?? []).map(skeleton),
});

/** Inspector props the builder shows: everything but slots and events. */
const fieldsOf = (id: string): CatalogPropSchema[] =>
  BUILDER_MANIFEST_BY_ID.get(id)?.props.filter(
    (prop) => prop.kind !== 'slot' && prop.kind !== 'event'
  ) ?? [];

interface Tally {
  [kind: string]: number;
}

async function assertInvariants(
  tree: CatalogTreeInput,
  where: string,
  tally: Tally
): Promise<void> {
  expect(builderTreeIssues(tree), `${where}: closed rules`).toEqual([]);
  expect(validateBuilderTree(tree), where).toBe(true);

  const text = prettyBlueprintJson(tree);
  const back = checkPayloadText(text);
  expect(back.ok, `${where}: payload re-read`).toBe(true);
  if (!back.ok) return;
  expect(canonical(back.tree), `${where}: payload canonical`).toBe(canonical(tree));
  expect(prettyBlueprintJson(back.tree), `${where}: payload idempotent`).toBe(text);

  const player = createPlayer({ blueprint: text, catalog, tier: 'untrusted' });
  const draft = player.state.validation.draft;
  expect(draft, `${where}: player read`).not.toBeNull();
  expect(canonical(draft), `${where}: player canonical`).toBe(canonical(tree));
  const digest = await player.digest();
  if (player.state.validation.ok) {
    tally.playerValid = (tally.playerValid ?? 0) + 1;
    expect(digest, `${where}: digest`).toBe(await blueprintDigest(tree));
  } else {
    expect(digest, `${where}: digest of an invalid draft`).toBeNull();
  }
  player.dispose();

  expect(treeFromRows(tree), `${where}: outline rows`).toEqual(skeleton(tree));

  const ids: string[] = [];
  for (const { node } of nodes(tree)) ids.push(...blockIds({ id: node.id, props: node.props }));
  expect(new Set(ids).size, `${where}: block ids unique`).toBe(ids.length);

  for (const { node, path } of nodes(tree)) {
    for (const prop of fieldsOf(node.id)) {
      const value = node.props?.[prop.name];
      const at = `${where}: field ${path.join('.') || 'root'}.${prop.name}`;
      if (node.id === 'blocks-text' && prop.name === 'block') {
        if (value !== undefined && isTextType((value as { type?: unknown }).type)) {
          expect(editableBlock(value), at).toEqual(value);
        }
      } else if (isNumberProp(prop)) {
        const reading = readNumber(prop, value);
        if (reading.state === 'set') {
          expect(parseNumberInput(prop, String(reading.value)), at).toEqual({
            ok: true,
            value: reading.value,
          });
        }
      } else if (isChoiceProp(prop) && prop.kind === 'enum') {
        const reading = readChoice(prop, value);
        if (reading.state === 'set') {
          expect(enumInput(prop, String(reading.value)), at).toEqual({
            ok: true,
            value: reading.value,
          });
        }
      }
    }
  }
}

/** One random inspector write, mapped through the field models the builder uses. */
function inspectorOp(rng: Rng, tree: CatalogTreeInput): EditOp | null {
  const { node, path } = rng.pick(nodes(tree));
  const fields = fieldsOf(node.id);
  if (fields.length === 0) return null;
  const prop = rng.pick(fields);
  const current = node.props?.[prop.name];
  let value: unknown;
  if (node.id === 'blocks-text' && prop.name === 'block') {
    const block = editableBlock(current);
    value = rng.chance(0.3)
      ? switchType(block, rng.pick(TEXT_TYPES))
      : setField(
          block,
          block.type === 'heading'
            ? 'text'
            : block.type === 'quote'
              ? 'quote'
              : block.type === 'callout'
                ? 'body'
                : 'markdown',
          `${phrase(rng)}.`
        );
    if (block.type === 'list') value = textBlock(rng);
  } else if (isNumberProp(prop)) {
    const input = parseNumberInput(prop, rng.chance(0.15) ? '' : String(rng.int(120)));
    if (!input.ok) return null;
    value = input.value;
  } else if (isChoiceProp(prop)) {
    if (prop.kind === 'boolean') value = !switchChecked(prop, current);
    else {
      const input = enumInput(prop, rng.chance(0.2) ? '' : rng.pick(prop.enumValues ?? ['']));
      if (!input.ok) return null;
      value = input.value;
    }
  } else if (prop.kind === 'string') {
    // The builder's text box: an empty box clears the prop. `class` is tried too and refused.
    value = rng.chance(0.15) ? undefined : phrase(rng);
  } else {
    return null;
  }
  return value === undefined
    ? { op: 'unsetProp', path, name: prop.name }
    : { op: 'setProp', path, name: prop.name, value };
}

/** A JSON text a person might commit, built from the current payload. */
function validJsonText(rng: Rng, tree: CatalogTreeInput): string {
  const data = JSON.parse(prettyBlueprintJson(tree)) as CatalogTreeInput;
  const target = rng.pick(nodes(data)).node;
  if (fieldsOf(target.id).some((prop) => prop.name === 'title')) {
    (target as { props?: Record<string, unknown> }).props = { ...target.props, title: phrase(rng) };
  }
  // Any formatting: the commit normalizes it.
  return rng.chance(0.5) ? JSON.stringify(data) : JSON.stringify(data, null, 1 + rng.int(4));
}

/** A hostile or broken text: it must be refused whole. */
function hostileJsonText(rng: Rng, tree: CatalogTreeInput): { text: string; kind: string } {
  const text = prettyBlueprintJson(tree);
  const data = JSON.parse(text) as CatalogTreeInput & { props?: Record<string, unknown> };
  const kind = rng.pick([
    'unknown-prop',
    'handler',
    'class',
    'unknown-id',
    'truncated',
    'duplicate',
    'extra-field',
    'props-array',
    'children-object',
  ]);
  switch (kind) {
    case 'unknown-prop':
      return { kind, text: JSON.stringify({ ...data, props: { ...data.props, colour: 'red' } }) };
    case 'handler':
      return { kind, text: JSON.stringify({ ...data, props: { ...data.props, onclick: 'x' } }) };
    case 'class':
      return { kind, text: JSON.stringify({ ...data, props: { ...data.props, class: 'x' } }) };
    case 'unknown-id':
      return {
        kind,
        text: JSON.stringify({ ...data, children: [...(data.children ?? []), { id: 'dialog' }] }),
      };
    case 'truncated':
      return { kind, text: text.slice(0, Math.max(1, rng.int(text.length - 1))) };
    case 'duplicate':
      return { kind, text: text.replace('{', '{\n  "id": "layout-doc",') };
    case 'props-array':
      return { kind, text: JSON.stringify({ ...data, props: [] }) };
    case 'children-object':
      return { kind, text: JSON.stringify({ ...data, children: { 0: data.children?.[0] ?? {} } }) };
    default:
      // A node field the builder does not edit (here an incomplete condition).
      return { kind, text: JSON.stringify({ ...data, when: { op: 'gt' } }) };
  }
}

/** A random selection of 1–3 non-root rows, as the outline's multi-select would hold. */
function selection(rng: Rng, tree: CatalogTreeInput): number[][] {
  const movable = nodes(tree).filter(({ path }) => path.length > 0);
  const picked: number[][] = [];
  for (let count = 1 + rng.int(3); count > 0 && movable.length > 0; count -= 1) {
    picked.push(rng.pick(movable).path);
  }
  return picked;
}

/** One outline node operation: the ops the outline would send, or `null` when its model refuses. */
function outlineOps(rng: Rng, tree: CatalogTreeInput, clipboard: CatalogTreeInput[]) {
  const paths = selection(rng, tree);
  if (paths.length === 0) return null;
  const kind = rng.pick(['group-move', 'group-drop', 'group-remove', 'duplicate', 'paste']);
  if (kind === 'group-remove') return { kind, ops: groupRemoveOps(paths) };
  if (kind === 'paste') {
    if (rng.chance(0.6) || clipboard.length === 0)
      clipboard.splice(0, clipboard.length, ...copySubtrees(tree, paths));
    const result = pasteOps(tree, clipboard, rng.pick(nodes(tree)).path, canContain);
    return result.ok ? { kind, ops: result.ops } : null;
  }
  const result =
    kind === 'duplicate'
      ? duplicateOps(tree, paths)
      : kind === 'group-move'
        ? groupKeyboardMove(
            tree,
            paths,
            rng.pick<MoveIntent>(['up', 'down', 'indent', 'outdent']),
            canContain
          )
        : groupDropMove(
            tree,
            paths,
            rng.pick(nodes(tree)).path,
            rng.pick<DropPosition>(['before', 'after', 'inside']),
            canContain
          );
  return result.ok ? { kind, ops: result.ops as EditOp[] } : null;
}

async function runSeed(seed: number, tally: Tally): Promise<void> {
  const rng = generator(seed);
  blockSerial = 0;
  const clipboard: CatalogTreeInput[] = [];
  const history = createBuilderHistory();
  const log: string[] = [];
  const where = () => `seed ${seed} after [${log.join(', ')}]`;
  await assertInvariants(history.tree, where(), tally);

  for (let step = 0; step < STEPS; step += 1) {
    const before = history.tree;
    const roll = rng.int(100);
    const count = (kind: string) => {
      tally[kind] = (tally[kind] ?? 0) + 1;
      log.push(kind);
    };
    if (roll < 24) {
      const containers = nodes(before).filter(({ node }) => canContain(node.id));
      const { node, path } = rng.pick(containers);
      const id = rng.pick(Object.keys(INSERTS));
      const result = history.apply({
        op: 'insert',
        parent: path,
        index: rng.int((node.children?.length ?? 0) + 1),
        node: {
          id,
          props: (INSERTS[id] as (r: Rng) => Record<string, unknown>)(rng),
          children: [],
        },
      });
      count(result.ok ? 'insert' : 'insert-refused');
      if (!result.ok) expect(history.tree, where()).toBe(before);
    } else if (roll < 32) {
      const removable = nodes(before).filter(({ path }) => path.length > 0);
      if (removable.length === 0) continue;
      const result = history.apply({ op: 'remove', path: rng.pick(removable).path });
      count(result.ok ? 'remove' : 'remove-refused');
    } else if (roll < 42) {
      const movable = nodes(before).filter(({ path }) => path.length > 0);
      if (movable.length === 0) continue;
      const intent = rng.pick<MoveIntent>(['up', 'down', 'indent', 'outdent']);
      const move = keyboardMove(before, rng.pick(movable).path, intent, canContain);
      if (!move.ok) {
        count('move-impossible');
        continue;
      }
      // The outline's rule: the edit core must accept it and it must not add structural errors.
      const next = applyEditOp(before, move.op);
      if (!next.ok || !moveKeepsStructure(before, next.tree)) {
        count('move-refused');
        continue;
      }
      const result = history.apply(move.op);
      expect(result.ok, where()).toBe(true);
      count('move');
    } else if (roll < 58) {
      const planned = outlineOps(rng, before, clipboard);
      if (!planned || planned.ops.length === 0) {
        count('outline-impossible');
        continue;
      }
      // The builder's applyStructural rule (removals go straight to the history, as in the outline).
      const next = applyEditOps(before, planned.ops);
      expect(next.ok, `${where()}: ${planned.kind} ops apply`).toBe(true);
      if (!next.ok) continue;
      if (planned.kind !== 'group-remove' && !moveKeepsStructure(before, next.tree)) {
        count(`${planned.kind}-refused`);
        expect(history.tree, where()).toBe(before);
        continue;
      }
      const result = history.apply(planned.ops);
      expect(result.ok, `${where()}: ${planned.kind}`).toBe(true);
      // One step: a single undo restores the tree exactly.
      if (rng.chance(0.25)) {
        expect(history.undo(), where()).toBe(true);
        expect(canonical(history.tree), `${where()}: ${planned.kind} undo`).toBe(canonical(before));
        expect(history.redo(), where()).toBe(true);
      }
      count(planned.kind);
    } else if (roll < 76) {
      const op = inspectorOp(rng, before);
      if (!op) continue;
      const result = history.apply(op, { coalesceKey: `prop:${op.path.join('.')}:${op.name}` });
      count(result.ok ? 'inspector' : 'inspector-refused');
      if (!result.ok) expect(history.tree, where()).toBe(before);
    } else if (roll < 81) {
      count(history.undo() ? 'undo' : 'undo-empty');
    } else if (roll < 92) {
      const text = validJsonText(rng, before);
      const checked = checkPayloadText(text);
      expect(checked.ok, `${where()}: valid JSON`).toBe(true);
      if (!checked.ok) continue;
      const result = history.apply({ op: 'replaceAll', tree: checked.tree });
      expect(result.ok, where()).toBe(true);
      expect(canonical(history.tree), where()).toBe(canonical(JSON.parse(text)));
      count('json');
    } else {
      const { text, kind } = hostileJsonText(rng, before);
      const checked = checkPayloadText(text);
      expect(checked.ok, `${where()}: hostile JSON ${kind}`).toBe(false);
      // Even forced past the panel, the history's closed rules refuse what parses.
      try {
        const parsed = JSON.parse(text) as CatalogTreeInput;
        expect(history.apply({ op: 'replaceAll', tree: parsed }).ok, `${where()}: ${kind}`).toBe(
          kind === 'duplicate'
        );
      } catch {
        // Not JSON: nothing to force.
      }
      if (kind === 'duplicate') history.undo();
      expect(canonical(history.tree), where()).toBe(canonical(before));
      count(`json-refused:${kind}`);
    }
    await assertInvariants(history.tree, where(), tally);
  }
  expect(nodeAt(history.tree, []), where()).toBeDefined();
}

describe('builder round-trip property (Task 72)', () => {
  it(`holds for ${SEEDS} seeded sequences of ${STEPS} steps`, async () => {
    const tally: Tally = {};
    for (let seed = 1; seed <= SEEDS; seed += 1) await runSeed(seed, tally);
    // TEXULI_PROPERTY_TALLY=1 prints how often each step kind ran.
    if (process.env.TEXULI_PROPERTY_TALLY) console.log(JSON.stringify(tally));
    // The generator really exercised every kind of step (deterministic per seed set).
    for (const kind of [
      'insert',
      'remove',
      'move',
      'group-move',
      'group-drop',
      'group-remove',
      'duplicate',
      'paste',
      'inspector',
      'json',
      'undo',
      'playerValid',
    ]) {
      expect(tally[kind] ?? 0, `${kind} ran`).toBeGreaterThan(0);
    }
    expect(
      Object.keys(tally).filter((kind) => kind.startsWith('json-refused:')).length,
      'hostile kinds covered'
    ).toBeGreaterThanOrEqual(5);
  }, 120_000);

  it('pins the counterexample it found: the history refuses node shapes the panel refuses', () => {
    // Seed 1 committed `{ ..., "when": { "op": "gt" } }` past the panel: the history accepted it.
    const page = { id: 'layout-page', props: { title: 'Fictional' }, children: [] };
    for (const hostile of [
      { ...page, when: { op: 'gt' } },
      { ...page, slot: 'hero' },
      { ...page, props: [] },
      { ...page, children: { 0: { id: 'blocks-text' } } },
    ]) {
      const history = createBuilderHistory();
      expect(
        history.apply({ op: 'replaceAll', tree: hostile as never }).ok,
        JSON.stringify(hostile)
      ).toBe(false);
      expect(validateBuilderTree(hostile), JSON.stringify(hostile)).toBe(false);
      expect(builderTreeIssues(hostile).length, JSON.stringify(hostile)).toBeGreaterThan(0);
    }
  });

  it('is deterministic: the same seed gives the same final tree', async () => {
    const finalTree = async (seed: number) => {
      const rng = generator(seed);
      const history = createBuilderHistory();
      for (let i = 0; i < 12; i += 1) {
        const op = inspectorOp(rng, history.tree);
        if (op) history.apply(op);
        const containers = nodes(history.tree).filter(({ node }) => canContain(node.id));
        const { path } = rng.pick(containers);
        history.apply({
          op: 'insert',
          parent: path,
          index: 0,
          node: { id: 'blocks-text', props: { block: textBlock(rng) }, children: [] },
        });
      }
      return canonical(history.tree);
    };
    expect(await finalTree(7)).toBe(await finalTree(7));
    expect(await finalTree(7)).not.toBe(await finalTree(8));
  });
});

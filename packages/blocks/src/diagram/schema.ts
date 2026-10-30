/**
 * Bounded diagram models (flow, tree/org, board, terminal). Untrusted input
 * is parsed without throwing; diagnostics use blueprint-style JSON paths.
 * No third-party schema library.
 */

import { BLOCK_LIMITS } from '../core/limits.ts';
import type { BlockBase } from '../core/schema/primitives.ts';
import {
  type FieldIssue,
  fail,
  failMany,
  ok,
  type ParseResult,
  parseBlockBase,
  parsePlainText,
  parseTone,
  toJsonPath,
} from '../core/schema/primitives.ts';
import type { BlockTone } from '../core/schema/vocabulary.ts';

export const DIAGRAM_LIMITS = Object.freeze({
  flowNodes: BLOCK_LIMITS.flowNodes,
  treeNodes: BLOCK_LIMITS.treeNodes,
  treeDepth: BLOCK_LIMITS.treeDepth,
  boardColumns: BLOCK_LIMITS.boardColumns,
  boardCardsPerColumn: BLOCK_LIMITS.boardCardsPerColumn,
  terminalLines: BLOCK_LIMITS.terminalLines,
});

const DIAGRAM_ID = /^[a-z][a-z0-9-]{0,47}$/;

export type FlowNode = { id: string; label: string; tone?: BlockTone };
export type FlowDiagram = BlockBase & {
  type: 'flow';
  nodes: FlowNode[];
  loopBack?: boolean;
};

export type TreeNode = {
  id: string;
  parentId: string | null;
  label: string;
  tone?: BlockTone;
};
/** How a tree draws: an indented file tree or a top-down org chart. */
export type TreeVariant = 'file-tree' | 'org';
export type TreeDiagram = BlockBase & {
  type: 'tree';
  /**
   * Named `style` until 0.8; renamed because the untrusted sink scan refuses
   * every `style` key, so agents could never send a tree. The parser still
   * accepts `style` as an alias through 0.9.x (removed in 0.10.0).
   */
  variant: TreeVariant;
  nodes: TreeNode[];
};

export type BoardCard = { id: string; title: string; tone?: BlockTone };
export type BoardColumn = { id: string; title: string; cards: BoardCard[] };
export type BoardDiagram = BlockBase & {
  type: 'board';
  columns: BoardColumn[];
};

export type TerminalLine = { kind: 'prompt' | 'output' | 'comment'; text: string };
export type TerminalDiagram = BlockBase & {
  type: 'terminal';
  lines: TerminalLine[];
};

export type Diagram = FlowDiagram | TreeDiagram | BoardDiagram | TerminalDiagram;
export type DiagramType = Diagram['type'];

export const DIAGRAM_BLOCK_TYPES = [
  'flow',
  'tree',
  'board',
  'terminal',
] as const satisfies readonly DiagramType[];

export type DiagramParseResult =
  | { success: true; data: Diagram }
  | { success: false; issues: { jsonPath: string; message: string }[] };

export function diagramJsonPath(path: readonly (string | number)[]): string {
  return toJsonPath(path);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDiagramId(value: unknown, path: (string | number)[]): ParseResult<string> {
  if (typeof value !== 'string' || !DIAGRAM_ID.test(value)) {
    return fail(path, 'Use 1–48 lowercase letters, digits or hyphens, starting with a letter');
  }
  return ok(value);
}

function parseFlow(
  record: Record<string, unknown>,
  path: (string | number)[]
): ParseResult<FlowDiagram> {
  const base = parseBlockBase(record, path);
  if (!base.success) return base;
  if (!Array.isArray(record.nodes)) return fail([...path, 'nodes'], 'nodes must be an array');
  if (record.nodes.length < 1 || record.nodes.length > DIAGRAM_LIMITS.flowNodes) {
    return fail([...path, 'nodes'], `nodes must have 1–${DIAGRAM_LIMITS.flowNodes} items`);
  }
  if (record.loopBack !== undefined && typeof record.loopBack !== 'boolean') {
    return fail([...path, 'loopBack'], 'loopBack must be a boolean');
  }
  const nodes: FlowNode[] = [];
  const ids = new Set<string>();
  const issues: FieldIssue[] = [];
  record.nodes.forEach((raw, index) => {
    if (!isPlainObject(raw)) {
      issues.push({ path: [...path, 'nodes', index], message: 'Expected a node object' });
      return;
    }
    const id = parseDiagramId(raw.id, [...path, 'nodes', index, 'id']);
    if (!id.success) {
      issues.push(...id.issues);
      return;
    }
    if (ids.has(id.data)) {
      issues.push({
        path: [...path, 'nodes', index, 'id'],
        message: `Duplicate node id: ${id.data}`,
      });
    }
    ids.add(id.data);
    const label = parsePlainText(raw.label, [...path, 'nodes', index, 'label'], 120);
    if (!label.success) {
      issues.push(...label.issues);
      return;
    }
    const tone = parseTone(raw.tone, [...path, 'nodes', index, 'tone']);
    if (!tone.success) {
      issues.push(...tone.issues);
      return;
    }
    const node: FlowNode = { id: id.data, label: label.data };
    if (tone.data !== undefined) node.tone = tone.data;
    nodes.push(node);
  });
  if (issues.length > 0) return failMany(issues);
  const data: FlowDiagram = { ...base.data, type: 'flow', nodes };
  if (record.loopBack === true) data.loopBack = true;
  return ok(data);
}

const TREE_VARIANTS: readonly TreeVariant[] = ['file-tree', 'org'];
const isTreeVariant = (value: unknown): value is TreeVariant =>
  TREE_VARIANTS.includes(value as TreeVariant);

/** `variant`, or the deprecated `style` alias (accepted through 0.9.x; they must agree). */
function parseTreeVariant(
  record: Record<string, unknown>,
  path: (string | number)[]
): ParseResult<TreeVariant> {
  if (record.style !== undefined) {
    if (!isTreeVariant(record.style)) {
      return fail([...path, 'style'], 'style (renamed variant) must be "file-tree" or "org"');
    }
    if (record.variant !== undefined && record.variant !== record.style) {
      return fail([...path, 'style'], 'style is the old name of variant; send variant only');
    }
  }
  const value = record.variant ?? record.style;
  if (!isTreeVariant(value)) {
    return fail([...path, 'variant'], 'variant must be "file-tree" or "org"');
  }
  return ok(value);
}

function parseTree(
  record: Record<string, unknown>,
  path: (string | number)[]
): ParseResult<TreeDiagram> {
  const base = parseBlockBase(record, path);
  if (!base.success) return base;
  const variant = parseTreeVariant(record, path);
  if (!variant.success) return variant;
  if (!Array.isArray(record.nodes)) return fail([...path, 'nodes'], 'nodes must be an array');
  if (record.nodes.length < 1 || record.nodes.length > DIAGRAM_LIMITS.treeNodes) {
    return fail([...path, 'nodes'], `nodes must have 1–${DIAGRAM_LIMITS.treeNodes} items`);
  }
  const nodes: TreeNode[] = [];
  const byId = new Map<string, TreeNode>();
  const issues: FieldIssue[] = [];
  record.nodes.forEach((raw, index) => {
    if (!isPlainObject(raw)) {
      issues.push({ path: [...path, 'nodes', index], message: 'Expected a node object' });
      return;
    }
    const id = parseDiagramId(raw.id, [...path, 'nodes', index, 'id']);
    if (!id.success) {
      issues.push(...id.issues);
      return;
    }
    if (byId.has(id.data)) {
      issues.push({
        path: [...path, 'nodes', index, 'id'],
        message: `Duplicate node id: ${id.data}`,
      });
    }
    let parentId: string | null;
    if (raw.parentId === null) parentId = null;
    else {
      const parent = parseDiagramId(raw.parentId, [...path, 'nodes', index, 'parentId']);
      if (!parent.success) {
        issues.push(...parent.issues);
        return;
      }
      parentId = parent.data;
    }
    const label = parsePlainText(raw.label, [...path, 'nodes', index, 'label'], 120);
    if (!label.success) {
      issues.push(...label.issues);
      return;
    }
    const tone = parseTone(raw.tone, [...path, 'nodes', index, 'tone']);
    if (!tone.success) {
      issues.push(...tone.issues);
      return;
    }
    const node: TreeNode = { id: id.data, parentId, label: label.data };
    if (tone.data !== undefined) node.tone = tone.data;
    nodes.push(node);
    byId.set(node.id, node);
  });
  if (issues.length > 0) return failMany(issues);

  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length === 0) {
    return fail([...path, 'nodes'], 'A tree needs at least one root node');
  }
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (!node) continue;
    if (node.parentId !== null && !byId.has(node.parentId)) {
      issues.push({
        path: [...path, 'nodes', index, 'parentId'],
        message: `Unknown parent id: ${node.parentId}`,
      });
      continue;
    }
    let depth = 1;
    let parentId = node.parentId;
    const visited = new Set([node.id]);
    while (parentId !== null && byId.has(parentId)) {
      if (visited.has(parentId)) {
        issues.push({
          path: [...path, 'nodes', index, 'parentId'],
          message: 'Tree contains a parent cycle',
        });
        break;
      }
      visited.add(parentId);
      depth += 1;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    if (depth > DIAGRAM_LIMITS.treeDepth) {
      issues.push({
        path: [...path, 'nodes', index],
        message: `Tree depth exceeds ${DIAGRAM_LIMITS.treeDepth}`,
      });
    }
  }
  if (issues.length > 0) return failMany(issues);
  return ok({ ...base.data, type: 'tree', variant: variant.data, nodes });
}

function parseBoard(
  record: Record<string, unknown>,
  path: (string | number)[]
): ParseResult<BoardDiagram> {
  const base = parseBlockBase(record, path);
  if (!base.success) return base;
  if (!Array.isArray(record.columns)) return fail([...path, 'columns'], 'columns must be an array');
  if (record.columns.length < 1 || record.columns.length > DIAGRAM_LIMITS.boardColumns) {
    return fail([...path, 'columns'], `columns must have 1–${DIAGRAM_LIMITS.boardColumns} items`);
  }
  const columns: BoardColumn[] = [];
  const ids = new Set<string>();
  const issues: FieldIssue[] = [];
  record.columns.forEach((rawCol, columnIndex) => {
    if (!isPlainObject(rawCol)) {
      issues.push({ path: [...path, 'columns', columnIndex], message: 'Expected a column object' });
      return;
    }
    const id = parseDiagramId(rawCol.id, [...path, 'columns', columnIndex, 'id']);
    if (!id.success) {
      issues.push(...id.issues);
      return;
    }
    if (ids.has(id.data)) {
      issues.push({
        path: [...path, 'columns', columnIndex, 'id'],
        message: `Duplicate diagram id: ${id.data}`,
      });
    }
    ids.add(id.data);
    const title = parsePlainText(rawCol.title, [...path, 'columns', columnIndex, 'title'], 120);
    if (!title.success) {
      issues.push(...title.issues);
      return;
    }
    if (!Array.isArray(rawCol.cards)) {
      issues.push({
        path: [...path, 'columns', columnIndex, 'cards'],
        message: 'cards must be an array',
      });
      return;
    }
    if (rawCol.cards.length > DIAGRAM_LIMITS.boardCardsPerColumn) {
      issues.push({
        path: [...path, 'columns', columnIndex, 'cards'],
        message: `cards must have at most ${DIAGRAM_LIMITS.boardCardsPerColumn} items`,
      });
      return;
    }
    const cards: BoardCard[] = [];
    rawCol.cards.forEach((rawCard, cardIndex) => {
      if (!isPlainObject(rawCard)) {
        issues.push({
          path: [...path, 'columns', columnIndex, 'cards', cardIndex],
          message: 'Expected a card object',
        });
        return;
      }
      const cardId = parseDiagramId(rawCard.id, [
        ...path,
        'columns',
        columnIndex,
        'cards',
        cardIndex,
        'id',
      ]);
      if (!cardId.success) {
        issues.push(...cardId.issues);
        return;
      }
      if (ids.has(cardId.data)) {
        issues.push({
          path: [...path, 'columns', columnIndex, 'cards', cardIndex, 'id'],
          message: `Duplicate diagram id: ${cardId.data}`,
        });
      }
      ids.add(cardId.data);
      const cardTitle = parsePlainText(
        rawCard.title,
        [...path, 'columns', columnIndex, 'cards', cardIndex, 'title'],
        120
      );
      if (!cardTitle.success) {
        issues.push(...cardTitle.issues);
        return;
      }
      const tone = parseTone(rawCard.tone, [
        ...path,
        'columns',
        columnIndex,
        'cards',
        cardIndex,
        'tone',
      ]);
      if (!tone.success) {
        issues.push(...tone.issues);
        return;
      }
      const card: BoardCard = { id: cardId.data, title: cardTitle.data };
      if (tone.data !== undefined) card.tone = tone.data;
      cards.push(card);
    });
    columns.push({ id: id.data, title: title.data, cards });
  });
  if (issues.length > 0) return failMany(issues);
  return ok({ ...base.data, type: 'board', columns });
}

function parseTerminal(
  record: Record<string, unknown>,
  path: (string | number)[]
): ParseResult<TerminalDiagram> {
  const base = parseBlockBase(record, path);
  if (!base.success) return base;
  if (!Array.isArray(record.lines)) return fail([...path, 'lines'], 'lines must be an array');
  if (record.lines.length < 1 || record.lines.length > DIAGRAM_LIMITS.terminalLines) {
    return fail([...path, 'lines'], `lines must have 1–${DIAGRAM_LIMITS.terminalLines} items`);
  }
  const lines: TerminalLine[] = [];
  const issues: FieldIssue[] = [];
  record.lines.forEach((raw, index) => {
    if (!isPlainObject(raw)) {
      issues.push({ path: [...path, 'lines', index], message: 'Expected a line object' });
      return;
    }
    if (raw.kind !== 'prompt' && raw.kind !== 'output' && raw.kind !== 'comment') {
      issues.push({
        path: [...path, 'lines', index, 'kind'],
        message: 'kind must be prompt, output or comment',
      });
      return;
    }
    const text = parsePlainText(raw.text, [...path, 'lines', index, 'text'], 240);
    if (!text.success) {
      issues.push(...text.issues);
      return;
    }
    lines.push({ kind: raw.kind, text: text.data });
  });
  if (issues.length > 0) return failMany(issues);
  return ok({ ...base.data, type: 'terminal', lines });
}

/** Parse an untrusted diagram without throwing. */
export function parseDiagram(input: unknown): DiagramParseResult {
  if (!isPlainObject(input)) {
    return { success: false, issues: [{ jsonPath: '$', message: 'Expected a diagram object' }] };
  }
  const type = input.type;
  let result: ParseResult<Diagram>;
  if (type === 'flow') result = parseFlow(input, []);
  else if (type === 'tree') result = parseTree(input, []);
  else if (type === 'board') result = parseBoard(input, []);
  else if (type === 'terminal') result = parseTerminal(input, []);
  else {
    return {
      success: false,
      issues: [{ jsonPath: '$["type"]', message: 'type must be flow, tree, board or terminal' }],
    };
  }
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    issues: result.issues.map((issue) => ({
      jsonPath: diagramJsonPath(issue.path),
      message: issue.message,
    })),
  };
}

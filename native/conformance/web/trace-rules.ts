/**
 * The shared semantic rules (`../semantics.json`) applied to a render tree:
 * the web half of the trace, also used by the native-plan simulation in
 * structure.ts. No side effects beyond reading semantics.json.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RenderNode } from '@texuli/catalog/render/renderer';

export interface Rule {
  role: string;
  name?: readonly string[];
  level?: string;
}
export interface Semantics {
  default: Rule;
  components: readonly (Rule & { id?: string; prefix?: string })[];
  blocks: Readonly<Record<string, Rule>>;
}
export interface TraceNode {
  id: string;
  role: string;
  name?: string;
  level?: number;
  children?: TraceNode[];
}

export const semantics = JSON.parse(
  readFileSync(join(import.meta.dirname, '../semantics.json'), 'utf8')
) as Semantics;

function pick(
  source: Record<string, unknown>,
  names: readonly string[] | undefined
): string | undefined {
  for (const name of names ?? []) {
    const value = source[name];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

/** The semantic trace of one render node (shared rules, see semantics.json). */
export function traceNode(node: RenderNode): TraceNode {
  if (node.kind === 'placeholder') return { id: node.id, role: 'placeholder', name: node.reason };
  const props = node.props as Record<string, unknown>;
  const block =
    node.id.startsWith('blocks-') && props.block !== null && typeof props.block === 'object'
      ? (props.block as Record<string, unknown>)
      : undefined;
  const rule: Rule =
    (block && typeof block.type === 'string' ? semantics.blocks[block.type] : undefined) ??
    semantics.components.find(
      (r) => r.id === node.id || (r.prefix !== undefined && node.id.startsWith(r.prefix))
    ) ??
    semantics.default;
  const source = block ?? props;
  const out: TraceNode = { id: node.id, role: rule.role };
  const name = pick(source, rule.name);
  if (name !== undefined) out.name = name;
  if (rule.level && typeof source[rule.level] === 'number')
    out.level = source[rule.level] as number;
  if (node.children.length > 0) out.children = node.children.map(traceNode);
  return out;
}

/*
 * Radial partition (sunburst): each node's angle span is proportional to its
 * value, depth maps to radius rings. Same hierarchy contract as treemap.
 * Pure; no DOM.
 */

import { TreemapError, type TreemapNode } from './treemap.ts';

export interface SunburstArc {
  id: string;
  label?: string;
  parentId: string | null;
  depth: number;
  value: number;
  leaf: boolean;
  /** Start angle in radians, clockwise from the positive x-axis. */
  x0: number;
  /** End angle in radians. */
  x1: number;
  /** Inner radius. */
  y0: number;
  /** Outer radius. */
  y1: number;
}

export interface SunburstOptions {
  /** Outer radius of the deepest ring (default 1). */
  radius?: number;
  /** Inner hole radius for the root ring (default 0). */
  innerRadius?: number;
  /** Start angle in radians (default 0). */
  startAngle?: number;
  /** End angle in radians (default 2π). */
  endAngle?: number;
  /** Pad angle between sibling arcs, radians (default 0). */
  padAngle?: number;
}

interface Sized {
  node: TreemapNode;
  value: number;
  children: Sized[];
}

function size(node: TreemapNode, seen: Set<string>): Sized {
  if (seen.has(node.id)) throw new TreemapError(`sunburst(): duplicate id "${node.id}"`, node.id);
  seen.add(node.id);
  const children = (node.children ?? []).map((child) => size(child, seen));
  if (children.length === 0) {
    const value = node.value ?? 0;
    if (!Number.isFinite(value) || value < 0) {
      throw new TreemapError(`sunburst(): "${node.id}" needs a finite value ≥ 0`, node.id);
    }
    return { node, value, children };
  }
  const sum = children.reduce((total, child) => total + child.value, 0);
  if (node.value !== undefined && Math.abs(node.value - sum) > 1e-9 * Math.max(1, Math.abs(sum))) {
    throw new TreemapError(
      `sunburst(): "${node.id}" is ${node.value} but its children sum to ${sum}`,
      node.id
    );
  }
  return { node, value: sum, children };
}

function maxDepth(node: Sized): number {
  if (node.children.length === 0) return 0;
  return 1 + Math.max(0, ...node.children.map(maxDepth));
}

/**
 * Lay out a hierarchy as sunburst arcs. Angles are proportional to value;
 * radius bands are equal per depth level from `innerRadius` to `radius`.
 */
export function sunburst(root: TreemapNode, options: SunburstOptions = {}): SunburstArc[] {
  const tree = size(root, new Set());
  const outer = Math.max(0, options.radius ?? 1);
  const inner = Math.min(outer, Math.max(0, options.innerRadius ?? 0));
  const a0 = options.startAngle ?? 0;
  const a1 = options.endAngle ?? Math.PI * 2;
  const pad = Math.max(0, options.padAngle ?? 0);
  const depthMax = Math.max(1, maxDepth(tree));
  const ring = (outer - inner) / depthMax;
  const out: SunburstArc[] = [];

  const visit = (
    node: Sized,
    parentId: string | null,
    depth: number,
    start: number,
    end: number
  ) => {
    const y0 = depth === 0 ? 0 : inner + (depth - 1) * ring;
    const y1 = depth === 0 ? inner : inner + depth * ring;
    const entry: SunburstArc = {
      id: node.node.id,
      parentId,
      depth,
      value: node.value,
      leaf: node.children.length === 0,
      x0: start,
      x1: end,
      y0,
      y1: Math.min(outer, y1),
    };
    if (node.node.label !== undefined) entry.label = node.node.label;
    out.push(entry);

    if (node.children.length === 0 || node.value <= 0) return;
    const span = end - start;
    const pads = pad * Math.max(0, node.children.length - 1);
    const usable = Math.max(0, span - pads);
    let cursor = start;
    for (const child of node.children) {
      const childSpan = usable * (child.value / node.value);
      visit(child, node.node.id, depth + 1, cursor, cursor + childSpan);
      cursor += childSpan + pad;
    }
  };

  visit(tree, null, 0, a0, a1);
  return out;
}

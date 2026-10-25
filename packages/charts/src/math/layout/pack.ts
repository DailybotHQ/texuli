/*
 * Circle packing of a hierarchy (Wang et al. / d3.pack approximation): each
 * leaf is a circle whose area is proportional to its value; parents enclose
 * their children. Pure; same node contract as treemap.
 */

import { TreemapError, type TreemapNode } from './treemap.ts';

export interface PackCircle {
  id: string;
  label?: string;
  parentId: string | null;
  depth: number;
  value: number;
  leaf: boolean;
  /** Center x. */
  x: number;
  /** Center y. */
  y: number;
  /** Radius. */
  r: number;
}

export interface PackOptions {
  /** Layout width (default 1). The packing is centered in the box. */
  width?: number;
  /** Layout height (default 1). */
  height?: number;
  /** Padding between sibling circles (default 0). */
  padding?: number;
}

interface Sized {
  node: TreemapNode;
  value: number;
  children: Sized[];
}

interface Placed {
  sized: Sized;
  x: number;
  y: number;
  r: number;
  children: Placed[];
}

function size(node: TreemapNode, seen: Set<string>): Sized {
  if (seen.has(node.id)) throw new TreemapError(`pack(): duplicate id "${node.id}"`, node.id);
  seen.add(node.id);
  const children = (node.children ?? []).map((child) => size(child, seen));
  if (children.length === 0) {
    const value = node.value ?? 0;
    if (!Number.isFinite(value) || value < 0) {
      throw new TreemapError(`pack(): "${node.id}" needs a finite value ≥ 0`, node.id);
    }
    return { node, value, children };
  }
  const sum = children.reduce((total, child) => total + child.value, 0);
  if (node.value !== undefined && Math.abs(node.value - sum) > 1e-9 * Math.max(1, Math.abs(sum))) {
    throw new TreemapError(
      `pack(): "${node.id}" is ${node.value} but its children sum to ${sum}`,
      node.id
    );
  }
  return { node, value: sum, children };
}

/** Place children in a ring / chain so they do not overlap, then enclose. */
function placeChildren(parent: Sized, padding: number): Placed {
  if (parent.children.length === 0) {
    const r = Math.sqrt(Math.max(0, parent.value) / Math.PI);
    return { sized: parent, x: 0, y: 0, r, children: [] };
  }

  const kids = parent.children.map((child) => placeChildren(child, padding));
  // Sort largest first for a stabler packing order.
  kids.sort((a, b) => b.r - a.r);

  if (kids.length === 1) {
    const only = kids[0] as Placed;
    only.x = 0;
    only.y = 0;
    const r = only.r + padding;
    return { sized: parent, x: 0, y: 0, r, children: kids };
  }

  // Place the first two on the x-axis, then pack each next circle against
  // the front chain (simple front-chain pack, good enough for chart layouts).
  const first = kids[0] as Placed;
  const second = kids[1] as Placed;
  first.x = 0;
  first.y = 0;
  second.x = first.r + second.r + padding;
  second.y = 0;

  const front: Placed[] = [first, second];
  for (let i = 2; i < kids.length; i++) {
    const c = kids[i] as Placed;
    let best: { x: number; y: number; score: number } | null = null;
    for (let a = 0; a < front.length; a++) {
      const A = front[a] as Placed;
      const B = front[(a + 1) % front.length] as Placed;
      const dA = A.r + c.r + padding;
      const dB = B.r + c.r + padding;
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const dist = Math.hypot(dx, dy);
      if (dist > dA + dB || dist === 0) continue;
      // Two circle intersection candidates.
      const mid = (dA * dA - dB * dB + dist * dist) / (2 * dist);
      const h2 = dA * dA - mid * mid;
      if (h2 < 0) continue;
      const h = Math.sqrt(h2);
      const mx = A.x + (mid * dx) / dist;
      const my = A.y + (mid * dy) / dist;
      const px = (-dy * h) / dist;
      const py = (dx * h) / dist;
      for (const sign of [1, -1] as const) {
        const x = mx + sign * px;
        const y = my + sign * py;
        let ok = true;
        for (const other of kids.slice(0, i)) {
          const need = other.r + c.r + padding - 1e-9;
          if (Math.hypot(x - other.x, y - other.y) < need) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const score = x * x + y * y;
        if (!best || score < best.score) best = { x, y, score };
      }
    }
    if (best) {
      c.x = best.x;
      c.y = best.y;
    } else {
      // Fallback: place to the right of the current bounding box.
      let maxX = 0;
      for (const k of kids.slice(0, i)) maxX = Math.max(maxX, k.x + k.r);
      c.x = maxX + c.r + padding;
      c.y = 0;
    }
    front.push(c);
  }

  // Enclosing circle (approx): center at children centroid, radius to farthest.
  let cx = 0;
  let cy = 0;
  for (const k of kids) {
    cx += k.x;
    cy += k.y;
  }
  cx /= kids.length;
  cy /= kids.length;
  let r = 0;
  for (const k of kids) {
    r = Math.max(r, Math.hypot(k.x - cx, k.y - cy) + k.r);
  }
  r += padding;
  // Shift children so parent is at origin.
  for (const k of kids) {
    k.x -= cx;
    k.y -= cy;
  }
  return { sized: parent, x: 0, y: 0, r, children: kids };
}

function collect(
  node: Placed,
  parentId: string | null,
  depth: number,
  ox: number,
  oy: number,
  out: PackCircle[]
) {
  const entry: PackCircle = {
    id: node.sized.node.id,
    parentId,
    depth,
    value: node.sized.value,
    leaf: node.sized.children.length === 0,
    x: ox + node.x,
    y: oy + node.y,
    r: node.r,
  };
  if (node.sized.node.label !== undefined) entry.label = node.sized.node.label;
  out.push(entry);
  for (const child of node.children) {
    collect(child, node.sized.node.id, depth + 1, entry.x, entry.y, out);
  }
}

/**
 * Pack a hierarchy into circles. The root is scaled and translated to fit
 * inside the width×height box (centered).
 */
export function pack(root: TreemapNode, options: PackOptions = {}): PackCircle[] {
  const tree = size(root, new Set());
  const width = Math.max(0, options.width ?? 1);
  const height = Math.max(0, options.height ?? 1);
  const padding = Math.max(0, options.padding ?? 0);
  const placed = placeChildren(tree, padding);
  const out: PackCircle[] = [];
  collect(placed, null, 0, 0, 0, out);

  if (placed.r <= 0 || width <= 0 || height <= 0) return out;

  const scale = Math.min(width, height) / (2 * placed.r);
  const cx = width / 2;
  const cy = height / 2;
  for (const circle of out) {
    circle.x = cx + circle.x * scale;
    circle.y = cy + circle.y * scale;
    circle.r *= scale;
  }
  return out;
}

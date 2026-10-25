import { categoricalColor } from '../colors/index.ts';
import type { TreemapNode } from '../math/layout/treemap.ts';

export interface PartWholeDatum {
  id: string;
  label: string;
  value: number;
}

export interface PartWholeTableLabels {
  table: string;
  category: string;
  value: string;
}

export interface PartWholeTableRow {
  id: string;
  label: string;
  value: number;
  depth?: number;
}

export type PartWholeTree = TreemapNode;

/** Read the theme's chart tokens with semantic-role fallbacks when no chart ramp exists. */
export function partWholeColor(index: number): string {
  return categoricalColor(index);
}

export function formatPartWholeValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function treeTableRows(root: PartWholeTree): PartWholeTableRow[] {
  const rows: PartWholeTableRow[] = [];
  const total = (node: PartWholeTree): number => {
    const children = node.children ?? [];
    return children.length
      ? children.reduce((sum, child) => sum + total(child), 0)
      : Number.isFinite(node.value) && (node.value ?? 0) > 0
        ? (node.value as number)
        : 0;
  };
  const visit = (node: PartWholeTree, depth: number): void => {
    rows.push({
      id: node.id,
      label: node.label ?? node.id,
      value: total(node),
      depth,
    });
    for (const child of node.children ?? []) visit(child, depth + 1);
  };
  visit(root, 0);
  return rows;
}

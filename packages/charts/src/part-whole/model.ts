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

/** Fail closed when a chart would ship without a usable accessible name. */
export function assertPartWholeChrome(title: string, description: string): void {
  if (title.trim() === '') {
    throw new TypeError('Part-whole charts need a non-empty title.');
  }
  if (description.trim() === '') {
    throw new TypeError('Part-whole charts need an accessible description.');
  }
}

export function formatPartWholeValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

/**
 * Conservative width of one character of the donut's center total, in em:
 * tabular digits run about 0.55 em and separators less, so 0.62 em never
 * underestimates the rendered text.
 */
const CENTER_TOTAL_EM_PER_CHAR = 0.62;

/**
 * Whether the donut's center total fits inside the inner hole. A total wider
 * than the hole would collide with the slices, so the component hides it and
 * the data table carries the value instead.
 */
export function centerTotalFits(text: string, innerRadius: number, fontSize: number): boolean {
  if (!(innerRadius > 0) || !(fontSize > 0)) return false;
  return text.length * CENTER_TOTAL_EM_PER_CHAR * fontSize <= innerRadius * 2;
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

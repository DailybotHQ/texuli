import { type PackCircle, pack, type TreemapNode } from '../math/index.ts';

export type PackTree = TreemapNode;

export interface PackTableLabels {
  table: string;
  category: string;
  value: string;
}

export const PACK_TABLE_LABELS: PackTableLabels = {
  table: 'View data table',
  category: 'Category',
  value: 'Value',
};

const CHART_FALLBACKS = [
  '--tx-primary',
  '--tx-success',
  '--tx-info',
  '--tx-warning',
  '--tx-destructive',
  '--tx-secondary',
  '--tx-accent',
  '--tx-link',
] as const;

export function packLabels(labels: Partial<PackTableLabels> | undefined): PackTableLabels {
  return { ...PACK_TABLE_LABELS, ...labels };
}

export function createPackLayout(
  root: PackTree,
  options: { width?: number; height?: number; padding?: number } = {}
): PackCircle[] {
  const width = Number.isFinite(options.width) ? Math.max(120, options.width as number) : 640;
  const height = Number.isFinite(options.height) ? Math.max(120, options.height as number) : 420;
  const padding = Number.isFinite(options.padding) ? Math.max(0, options.padding as number) : 2;
  return pack(root, { width, height, padding });
}

export function packColor(index: number): string {
  const normalized = Number.isFinite(index) ? Math.trunc(index) : 0;
  const slot =
    ((normalized % CHART_FALLBACKS.length) + CHART_FALLBACKS.length) % CHART_FALLBACKS.length;
  return `var(--tx-chart-${slot + 1}, var(${CHART_FALLBACKS[slot]}, CanvasText))`;
}

export function formatPackValue(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

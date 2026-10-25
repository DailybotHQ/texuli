import { type FunnelStepInput, funnelLayout } from '../math/layout/funnel.ts';
import { type SankeyLinkInput, type SankeyNodeInput, sankey } from '../math/layout/sankey.ts';

export interface FlowChartLabels {
  tableSummary: string;
  step: string;
  count: string;
  conversion: string;
  from: string;
  to: string;
  value: string;
  node: string;
  connection: string;
}

export const FLOW_CHART_LABELS: FlowChartLabels = {
  tableSummary: 'View data table',
  step: 'Step',
  count: 'Count',
  conversion: 'Conversion',
  from: 'From',
  to: 'To',
  value: 'Value',
  node: 'Node',
  connection: 'Connection',
};

export function flowChartLabels(labels: Partial<FlowChartLabels> | undefined): FlowChartLabels {
  return { ...FLOW_CHART_LABELS, ...labels };
}

export function formatFlowValue(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function formatFlowPercent(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(
        value
      );
}

export function flowColor(index: number): string {
  const slot = Number.isFinite(index) ? Math.abs(Math.trunc(index)) % 8 : 0;
  return `var(--tx-chart-${slot + 1}, var(--tx-primary, CanvasText))`;
}

export interface NetworkNodeInput {
  id: string;
  label?: string;
  value?: number;
}

export interface NetworkLinkInput {
  source: string;
  target: string;
  value?: number;
}

export interface NetworkNodeLayout extends NetworkNodeInput {
  x: number;
  y: number;
  radius: number;
}

export interface NetworkLinkLayout extends NetworkLinkInput {
  sourceIndex: number;
  targetIndex: number;
  path: string;
}

/** Place nodes on a stable circle so identical graph input always has identical geometry. */
export function networkLayout(
  nodes: readonly NetworkNodeInput[],
  links: readonly NetworkLinkInput[],
  width: number,
  height: number
): { nodes: NetworkNodeLayout[]; links: NetworkLinkLayout[] } {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('Network graph dimensions must be finite and greater than zero.');
  }
  const indexById = new Map<string, number>();
  nodes.forEach((node, index) => {
    if (!node.id.trim()) throw new TypeError('Network graph node ids must not be empty.');
    if (indexById.has(node.id)) throw new TypeError(`Duplicate network graph node "${node.id}".`);
    indexById.set(node.id, index);
  });

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(0, Math.min(width, height) * 0.36);
  const nodeLayouts = nodes.map((node, index): NetworkNodeLayout => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(nodes.length, 1);
    const value = Number.isFinite(node.value) && (node.value ?? 0) > 0 ? (node.value as number) : 1;
    return {
      ...node,
      x: round(centerX + Math.cos(angle) * radius),
      y: round(centerY + Math.sin(angle) * radius),
      radius: round(Math.max(4, Math.min(10, 5 + Math.log2(value + 1)))),
    };
  });
  const linkLayouts = links.map((link): NetworkLinkLayout => {
    if (link.value !== undefined && (!Number.isFinite(link.value) || link.value <= 0)) {
      throw new TypeError('Network graph connection values must be finite and greater than zero.');
    }
    const sourceIndex = indexById.get(link.source);
    const targetIndex = indexById.get(link.target);
    if (sourceIndex === undefined || targetIndex === undefined) {
      const missing = sourceIndex === undefined ? link.source : link.target;
      throw new TypeError(`Network graph link references unknown node "${missing}".`);
    }
    const source = nodeLayouts[sourceIndex];
    const target = nodeLayouts[targetIndex];
    if (!source || !target) throw new TypeError('Network graph link endpoints are unavailable.');
    return {
      ...link,
      sourceIndex,
      targetIndex,
      path: `M${source.x},${source.y}L${target.x},${target.y}`,
    };
  });
  return { nodes: nodeLayouts, links: linkLayouts };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export type { FunnelStepInput, SankeyLinkInput, SankeyNodeInput };
export { funnelLayout, sankey };

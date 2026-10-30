<script lang="ts">
import { Dashboard, type DashboardLayout } from '@texuli/data/dashboard';
import type { Snippet } from 'svelte';
import { getPlayerInteraction } from '../context.ts';

/**
 * `data-dashboard` (spec 0.8.0): a widget grid from plain JSON. Its children
 * are `data-dashboard-widget` nodes (the catalog refuses anything else). A
 * change people make on the widest grid updates the layout in view, writes
 * it back when `layout` is bound (or saves it through the host's data source
 * when `layout` reads one), and runs `on.change` with the widget id. Changes
 * on narrower grids stay in view only. Every layout value is normalized by
 * the dashboard engine before it paints.
 */
const ROW_HEIGHTS = { compact: 56, default: 80, comfortable: 112 } as const;

let {
  label,
  columns = 12,
  density = 'default',
  gap = 'medium',
  editable = false,
  compaction = 'vertical',
  layout,
  txPath,
  children,
}: {
  label: string;
  columns?: number;
  density?: 'compact' | 'default' | 'comfortable';
  gap?: 'none' | 'small' | 'medium' | 'large';
  editable?: boolean;
  compaction?: 'vertical' | 'none';
  layout?: DashboardLayout;
  txPath?: string;
  children?: Snippet;
} = $props();

const interaction = getPlayerInteraction();
let current = $state.raw<DashboardLayout | undefined>(undefined);
$effect.pre(() => {
  current = Array.isArray(layout) ? layout : undefined;
});
const rowHeight = $derived(ROW_HEIGHTS[density] ?? ROW_HEIGHTS.default);

async function onLayoutChange(
  next: DashboardLayout,
  detail: { breakpoint: string; widget: string }
): Promise<void> {
  if (detail.breakpoint !== 'lg') return;
  current = next;
  if (txPath === undefined) return;
  // A layout read from a host data source (spec 0.8.0) is saved through it:
  // the grid shows the change at once and the source may put it back.
  const saved = interaction?.save?.(txPath, 'layout', next) ?? null;
  if (saved === null) interaction?.write(txPath, 'layout', next);
  interaction?.dispatch(txPath, 'change', { value: detail.widget });
  if (saved) await saved;
}
</script>

<Dashboard
  {label}
  layout={current}
  {columns}
  {rowHeight}
  {gap}
  {editable}
  {compaction}
  {onLayoutChange}
>
  {@render children?.()}
</Dashboard>

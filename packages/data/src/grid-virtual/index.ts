/** Virtualized data grid with independent row and column windows. */

export {
  moveVirtualCell,
  type VirtualCellPosition,
  type VirtualGridColumn,
  type VirtualGridOptions,
  virtualGridWindow,
} from './model.ts';
export { default as VirtualDataGrid } from './VirtualDataGrid.svelte';

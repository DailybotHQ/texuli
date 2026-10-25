/** Reusable axis components and deterministic tick formatting. */
export { default as Axis } from './Axis.svelte';
export {
  type AxisFormatter,
  type AxisTick,
  type AxisValue,
  formatAxisValue,
  formatNumericAxisTick,
  formatTimeAxisTick,
  type NumericAxisFormatOptions,
} from './model.ts';

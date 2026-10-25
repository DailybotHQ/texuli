/**
 * `@texuli/primitives/number-field` (T-prim-number-field): a headless,
 * locale-aware number input with steppers (WAI-ARIA spinbutton).
 */

export { type NumberFieldContextValue, numberFieldContext } from './context.ts';
export { default as NumberFieldDecrement } from './NumberFieldDecrement.svelte';
export { default as NumberFieldIncrement } from './NumberFieldIncrement.svelte';
export { default as NumberFieldInput } from './NumberFieldInput.svelte';
export { default as NumberFieldRoot } from './NumberFieldRoot.svelte';
export {
  clampNumber,
  decimalPlaces,
  formatNumber,
  inputModeFor,
  isPartialNumber,
  largeStepNumber,
  type NumberFormatOptions,
  numberFormatter,
  type ParseResult,
  parseNumber,
  roundToPrecision,
  type StepOptions,
  snapToStep,
  stepNumber,
} from './number.ts';
export * as NumberField from './parts.ts';
export {
  createPressRepeat,
  PRESS_REPEAT_DELAY,
  PRESS_REPEAT_INTERVAL,
  type PressRepeat,
  type PressRepeatOptions,
} from './press-repeat.ts';

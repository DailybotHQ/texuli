import NumberFieldDecrement from './NumberFieldDecrement.svelte';
import NumberFieldIncrement from './NumberFieldIncrement.svelte';
import NumberFieldInput from './NumberFieldInput.svelte';
import NumberFieldRoot from './NumberFieldRoot.svelte';
import PinInputCell from './PinInputCell.svelte';
import PinInputRoot from './PinInputRoot.svelte';

export const NumberField = {
  Root: NumberFieldRoot,
  Input: NumberFieldInput,
  Increment: NumberFieldIncrement,
  Decrement: NumberFieldDecrement,
};

export const PinInput = { Root: PinInputRoot, Cell: PinInputCell };

export { default as NumberFieldDecrement } from './NumberFieldDecrement.svelte';
export { default as NumberFieldIncrement } from './NumberFieldIncrement.svelte';
export { default as NumberFieldInput } from './NumberFieldInput.svelte';
export { default as NumberFieldRoot } from './NumberFieldRoot.svelte';
export { default as PinInputCell } from './PinInputCell.svelte';
export { default as PinInputRoot } from './PinInputRoot.svelte';
export {
  NUMBER_PIN_SIZES,
  type NumberPinSize,
  numberFieldClass,
  pinInputClass,
} from './variants.ts';

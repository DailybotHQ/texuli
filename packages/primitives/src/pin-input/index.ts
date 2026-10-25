import Cell from './Cell.svelte';
import Root from './Root.svelte';

/** Headless one-time-code input: one real input drawn as cells. */
export const PinInput = Object.freeze({ Root, Cell });

export {
  acceptsValue,
  clampLength,
  MAX_PIN_LENGTH,
  type PinCell,
  type PinRules,
  pastedValue,
  pinCells,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from './pin-input.ts';

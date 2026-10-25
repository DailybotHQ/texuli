import { createPrimitiveContext } from '../internal/context.ts';
import type { NumberFormatOptions } from './number.ts';

export interface NumberFieldContextValue {
  readonly inputId: string;
  /** A part records its consumer `id` (or clears it), so references use the effective id. */
  claimId(part: 'input', id: string | null | undefined): void;
  readonly value: number | null;
  /** What the input shows: the user's draft while editing, else the formatted value. */
  readonly inputText: string;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly step: number;
  readonly largeStep: number;
  readonly locale: string | undefined;
  readonly formatOptions: NumberFormatOptions | undefined;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly required: boolean;
  readonly allowWheel: boolean;
  readonly canIncrement: boolean;
  readonly canDecrement: boolean;
  readonly incrementLabel: string;
  readonly decrementLabel: string;
  /** The formatted value for `aria-valuetext`. */
  readonly valueText: string;
  setDraft(text: string): void;
  /** Parse the draft and commit it (clamped, optionally snapped); revert when it does not parse. */
  commit(): void;
  /** Step by `direction` steps (APG Up/Down), or `±largeStep` with `large`. */
  stepBy(direction: number, large?: boolean): void;
  /** Jump to the minimum or maximum (APG Home/End). */
  toBound(bound: 'min' | 'max'): void;
  setInputElement(element: HTMLInputElement | null): void;
  focusInput(): void;
}

export const numberFieldContext = createPrimitiveContext<NumberFieldContextValue>('NumberField');

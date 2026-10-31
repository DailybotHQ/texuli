import type { Component } from 'svelte';
import type { FormField, FormValue } from '../../model/types.ts';
import type { SchemaFormLabels } from '../labels.ts';

/**
 * The field types whose texuli control SchemaForm loads on first use (G119),
 * so a form that never paints them never downloads them or their CSS.
 */
export const LAZY_CONTROL_TYPES = Object.freeze([
  'date',
  'time',
  'datetime',
  'slider',
  'tags',
  'file',
  'color',
  'radio',
] as const);
export type LazyControlType = (typeof LAZY_CONTROL_TYPES)[number];

export const isLazyControlType = (type: string): type is LazyControlType =>
  (LAZY_CONTROL_TYPES as readonly string[]).includes(type);

/** What SchemaForm hands a per-type control. */
export interface SchemaFormControlProps {
  field: FormField;
  value: FormValue | undefined;
  /**
   * Attributes for the focusable control: `id`, `aria-describedby`,
   * `aria-invalid`, `aria-required` and `disabled` (from the texuli Field).
   */
  attrs: Readonly<Record<string, unknown>>;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  labels: SchemaFormLabels;
  /** The `File`s a file field holds. */
  files: readonly File[];
  onValue: (value: unknown) => void;
  onFiles: (files: File[]) => void;
}

export type SchemaFormControl = Component<SchemaFormControlProps>;

/** What the step navigation of a multi-step form receives. */
export interface SchemaFormProgressProps {
  steps: readonly { readonly id: string; readonly label: string }[];
  current: number;
  label: string;
  onStepClick: ((index: number) => void) | undefined;
}

/**
 * Controls by field type. Pass the static registry (`SCHEMA_FORM_CONTROLS`
 * from `@texuli/forms/controls`) as SchemaForm's `controls` to paint every
 * control at once (server rendering), or any subset to replace one.
 */
export type SchemaFormControls = Readonly<
  Partial<Record<LazyControlType, SchemaFormControl>> & {
    /** The step navigation of multi-step forms (a texuli Stepper). */
    progress?: Component<SchemaFormProgressProps>;
  }
>;

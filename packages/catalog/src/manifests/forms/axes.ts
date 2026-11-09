import { manifestData } from '../../manifest/data.ts';
import type { CatalogAxisName, CatalogManifest, CatalogStateName } from '../../manifest/types.ts';

type AxisStamp = {
  readonly axes?: Readonly<Partial<Record<CatalogAxisName, string>>>;
  readonly states?: readonly CatalogStateName[];
};

/**
 * Part A axes and states for the forms group (ADR-032). Axes name the enum
 * prop only; values come from that prop. States are the ones the control
 * paints or sets (CSS or ARIA), confirmed against the component source.
 */
export const FORMS_AXIS_STAMP: Readonly<Record<string, AxisStamp>> = {
  button: {
    axes: { variant: 'variant', size: 'size', tone: 'tone' },
    states: ['hover', 'focus-visible', 'disabled', 'loading'],
  },
  'button-group': { states: ['focus-visible'] },
  checkbox: {
    axes: { size: 'size' },
    states: ['focus-visible', 'disabled', 'invalid', 'checked'],
  },
  'code-field': {
    states: ['hover', 'focus-visible', 'disabled', 'invalid', 'readonly'],
  },
  combobox: {
    axes: { variant: 'variant', size: 'size' },
    states: ['hover', 'focus-visible', 'disabled', 'invalid', 'selected', 'open'],
  },
  description: { states: ['disabled'] },
  field: { states: ['disabled', 'invalid'] },
  'file-upload': {
    axes: { variant: 'variant' },
    states: ['focus-visible', 'disabled', 'invalid'],
  },
  'icon-button': {
    axes: { variant: 'variant' },
    states: ['hover', 'focus-visible', 'disabled', 'loading'],
  },
  input: {
    states: ['hover', 'focus-visible', 'disabled', 'invalid', 'readonly'],
  },
  'input-group': {
    states: ['hover', 'focus-visible', 'disabled', 'invalid', 'readonly'],
  },
  label: { axes: { size: 'size' }, states: ['disabled', 'invalid'] },
  'multi-select': {
    axes: { variant: 'variant', size: 'size' },
    states: ['hover', 'focus-visible', 'disabled', 'invalid', 'selected', 'open'],
  },
  'number-field': {
    axes: { size: 'size' },
    states: ['focus-visible', 'disabled', 'invalid', 'readonly'],
  },
  'pin-input': {
    axes: { size: 'size' },
    states: ['focus-visible', 'disabled', 'invalid'],
  },
  radio: {
    axes: { size: 'size' },
    states: ['hover', 'focus-visible', 'disabled', 'invalid', 'checked'],
  },
  'radio-group': {
    axes: { variant: 'variant', size: 'size' },
    states: ['disabled', 'readonly'],
  },
  rating: {
    axes: { size: 'size', tone: 'tone' },
    states: ['focus-visible', 'disabled', 'checked', 'readonly'],
  },
  select: {
    axes: { variant: 'variant', size: 'size' },
    states: ['hover', 'focus-visible', 'disabled', 'invalid', 'selected', 'open'],
  },
  'select-content': { axes: { size: 'size' } },
  'select-item': { states: ['hover', 'disabled', 'selected'] },
  'select-trigger': {
    axes: { variant: 'variant', size: 'size' },
    states: ['focus-visible', 'disabled', 'invalid', 'open'],
  },
  switch: { axes: { size: 'size' }, states: ['disabled', 'checked'] },
  'tags-input': {
    states: ['focus-visible', 'disabled', 'invalid', 'readonly'],
  },
  'text-counter': { states: ['disabled', 'invalid', 'readonly'] },
  textarea: { states: ['disabled', 'readonly'] },
  'time-field': {
    axes: { size: 'size' },
    states: ['hover', 'focus-visible', 'active', 'disabled', 'invalid', 'selected'],
  },
  'toggle-group': {
    axes: { variant: 'variant', size: 'size' },
    states: ['focus-visible', 'disabled'],
  },
};

/** Applies the part-A stamp. Components with neither axes nor states stay unchanged. */
export function stampFormsAxes(manifest: CatalogManifest): CatalogManifest {
  const extra = FORMS_AXIS_STAMP[manifest.id];
  return extra ? manifestData({ ...manifest, ...extra }) : manifest;
}

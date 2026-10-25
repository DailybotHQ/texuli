import { type ClassValue, cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './combobox.css';

export const COMBOBOX_SIZES = ['sm', 'md', 'lg'] as const;
export type ComboboxSize = (typeof COMBOBOX_SIZES)[number];

export const COMBOBOX_VARIANTS = ['outline', 'soft'] as const;
export type ComboboxVariant = (typeof COMBOBOX_VARIANTS)[number];

export const comboboxFieldClass = variants({
  base: 'tx-combobox-field',
  variants: {
    size: {
      sm: 'tx-combobox-field--sm',
      md: 'tx-combobox-field--md',
      lg: 'tx-combobox-field--lg',
    },
    variant: {
      outline: 'tx-combobox-field--outline',
      soft: 'tx-combobox-field--soft',
    },
  },
  defaultVariants: { size: 'md', variant: 'outline' },
});

export const comboboxInputClass = variants({
  base: 'tx-combobox-input',
  variants: {
    size: {
      sm: 'tx-combobox-input--sm',
      md: 'tx-combobox-input--md',
      lg: 'tx-combobox-input--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export const comboboxContentClass = variants({
  base: 'tx-combobox-content',
  variants: {
    size: {
      sm: 'tx-combobox-content--sm',
      md: 'tx-combobox-content--md',
      lg: 'tx-combobox-content--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export function comboboxItemClass(input?: {
  class?: ClassValue;
  disabled?: boolean;
  selected?: boolean;
}): string {
  return cx(
    'tx-combobox-item',
    input?.disabled && 'tx-combobox-item--disabled',
    input?.selected && 'tx-combobox-item--selected',
    input?.class
  );
}

export function comboboxTriggerClass(input?: { class?: ClassValue }): string {
  return cx('tx-combobox-trigger', input?.class);
}

export function comboboxChipsClass(input?: { class?: ClassValue }): string {
  return cx('tx-combobox-chips', input?.class);
}

export function comboboxChipClass(input?: { class?: ClassValue }): string {
  return cx('tx-combobox-chip', input?.class);
}

export function comboboxEmptyClass(input?: { class?: ClassValue }): string {
  return cx('tx-combobox-empty', input?.class);
}

export function comboboxErrorClass(input?: { class?: ClassValue }): string {
  return cx('tx-combobox-error', input?.class);
}

export function comboboxLoadingClass(input?: { class?: ClassValue }): string {
  return cx('tx-combobox-loading', input?.class);
}

export function comboboxRootClass(input?: { class?: ClassValue; multiple?: boolean }): string {
  return cx('tx-combobox-root', input?.multiple && 'tx-combobox-root--multiple', input?.class);
}

import { type ClassValue, cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './select.css';

export const SELECT_SIZES = ['sm', 'md', 'lg'] as const;
export type SelectSize = (typeof SELECT_SIZES)[number];

export const SELECT_VARIANTS = ['outline', 'soft'] as const;
export type SelectVariant = (typeof SELECT_VARIANTS)[number];

export const selectTriggerClass = variants({
  base: 'tx-select-trigger',
  variants: {
    size: {
      sm: 'tx-select-trigger--sm',
      md: 'tx-select-trigger--md',
      lg: 'tx-select-trigger--lg',
    },
    variant: {
      outline: 'tx-select-trigger--outline',
      soft: 'tx-select-trigger--soft',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'outline',
  },
});

export const selectContentClass = variants({
  base: 'tx-select-content',
  variants: {
    size: {
      sm: 'tx-select-content--sm',
      md: 'tx-select-content--md',
      lg: 'tx-select-content--lg',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export function selectItemClass(input?: {
  class?: ClassValue;
  disabled?: boolean;
  selected?: boolean;
}): string {
  return cx(
    'tx-select-item',
    input?.disabled && 'tx-select-item--disabled',
    input?.selected && 'tx-select-item--selected',
    input?.class
  );
}

export function selectGroupClass(input?: { class?: ClassValue }): string {
  return cx('tx-select-group', input?.class);
}

export function selectLabelClass(input?: { class?: ClassValue }): string {
  return cx('tx-select-label', input?.class);
}

export function selectSeparatorClass(input?: { class?: ClassValue }): string {
  return cx('tx-select-separator', input?.class);
}

export function selectValueClass(input?: { class?: ClassValue; placeholder?: boolean }): string {
  return cx('tx-select-value', input?.placeholder && 'tx-select-value--placeholder', input?.class);
}

export function selectIconClass(input?: { class?: ClassValue }): string {
  return cx('tx-select-icon', input?.class);
}

export function selectDescriptionClass(input?: { class?: ClassValue }): string {
  return cx('tx-select-description', input?.class);
}

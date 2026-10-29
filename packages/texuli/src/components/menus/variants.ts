import { type ClassValue, cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './menus.css';

export const MENU_SIZES = ['sm', 'md', 'lg'] as const;
export type MenuSize = (typeof MENU_SIZES)[number];

export const MENU_VARIANTS = ['default', 'soft'] as const;
export type MenuVariant = (typeof MENU_VARIANTS)[number];

export const menuContentClass = variants({
  base: 'tx-menu-content',
  variants: {
    size: {
      sm: 'tx-menu-content--sm',
      md: 'tx-menu-content--md',
      lg: 'tx-menu-content--lg',
    },
    variant: {
      default: 'tx-menu-content--default',
      soft: 'tx-menu-content--soft',
    },
  },
  defaultVariants: { size: 'md', variant: 'default' },
});

export const menuTriggerClass = variants({
  base: 'tx-menu-trigger',
  variants: {
    size: {
      sm: 'tx-menu-trigger--sm',
      md: 'tx-menu-trigger--md',
      lg: 'tx-menu-trigger--lg',
    },
    variant: {
      default: 'tx-menu-trigger--default',
      soft: 'tx-menu-trigger--soft',
    },
  },
  defaultVariants: { size: 'md', variant: 'default' },
});

export function menuItemClass(input?: {
  class?: ClassValue;
  disabled?: boolean;
  inset?: boolean;
  /** The danger tone for a destructive action. */
  destructive?: boolean;
}): string {
  return cx(
    'tx-menu-item',
    input?.disabled && 'tx-menu-item--disabled',
    input?.inset && 'tx-menu-item--inset',
    input?.destructive && 'tx-menu-item--destructive',
    input?.class
  );
}

export function menuLabelClass(input?: { class?: ClassValue }): string {
  return cx('tx-menu-label', input?.class);
}

export function menuSeparatorClass(input?: { class?: ClassValue }): string {
  return cx('tx-menu-separator', input?.class);
}

export function menuShortcutClass(input?: { class?: ClassValue }): string {
  return cx('tx-menu-shortcut', input?.class);
}

export function menuIconClass(input?: { class?: ClassValue }): string {
  return cx('tx-menu-icon', input?.class);
}

export function menuIndicatorClass(input?: { class?: ClassValue }): string {
  return cx('tx-menu-indicator', input?.class);
}

export function menubarRootClass(input?: { class?: ClassValue }): string {
  return cx('tx-menubar', input?.class);
}

export function contextTriggerClass(input?: { class?: ClassValue }): string {
  return cx('tx-context-menu-trigger', input?.class);
}

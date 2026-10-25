import { type ClassValue, cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './sidebar.css';

export const SIDEBAR_VARIANTS = ['default', 'inset'] as const;
export type SidebarVariant = (typeof SIDEBAR_VARIANTS)[number];

export const sidebarClass = variants({
  base: 'tx-sidebar',
  variants: {
    variant: {
      default: 'tx-sidebar--default',
      inset: 'tx-sidebar--inset',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function sidebarItemClass(input?: {
  class?: ClassValue;
  active?: boolean;
  collapsed?: boolean;
  disabled?: boolean;
}): string {
  return cx(
    'tx-sidebar__item',
    input?.active && 'tx-sidebar__item--active',
    input?.collapsed && 'tx-sidebar__item--collapsed',
    input?.disabled && 'tx-sidebar__item--disabled',
    input?.class
  );
}

export function sidebarSectionClass(input?: { class?: ClassValue }): string {
  return cx('tx-sidebar__section', input?.class);
}

export function sidebarToggleClass(input?: { class?: ClassValue; collapsed?: boolean }): string {
  return cx(
    'tx-sidebar__toggle',
    input?.collapsed && 'tx-sidebar__toggle--collapsed',
    input?.class
  );
}

export function appNavClass(input?: { class?: ClassValue }): string {
  return cx('tx-app-nav', input?.class);
}

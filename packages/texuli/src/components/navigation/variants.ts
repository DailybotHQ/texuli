import { type ClassValue, cx } from '../../internal/cx.ts';
import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './navigation.css';

export const NAV_SIZES = ['sm', 'md', 'lg'] as const;
export type NavSize = (typeof NAV_SIZES)[number];

export const navigationMenuClass = variants({
  base: 'tx-nav-menu',
  variants: {
    size: {
      sm: 'tx-nav-menu--sm',
      md: 'tx-nav-menu--md',
      lg: 'tx-nav-menu--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export function navigationMenuListClass(input?: { class?: ClassValue }): string {
  return cx('tx-nav-menu__list', input?.class);
}

export function navigationMenuItemClass(input?: { class?: ClassValue }): string {
  return cx('tx-nav-menu__item', input?.class);
}

export function navigationMenuTriggerClass(input?: { class?: ClassValue }): string {
  return cx('tx-nav-menu__trigger', input?.class);
}

export function navigationMenuContentClass(input?: { class?: ClassValue }): string {
  return cx('tx-nav-menu__content', input?.class);
}

export function navigationMenuLinkClass(input?: { class?: ClassValue; active?: boolean }): string {
  return cx('tx-nav-menu__link', input?.active && 'tx-nav-menu__link--active', input?.class);
}

export function navigationMenuViewportClass(input?: { class?: ClassValue }): string {
  return cx('tx-nav-menu__viewport', input?.class);
}

export function navigationMenuIndicatorClass(input?: { class?: ClassValue }): string {
  return cx('tx-nav-menu__indicator', input?.class);
}

export const breadcrumbClass = variants({
  base: 'tx-breadcrumb',
  variants: {
    size: {
      sm: 'tx-breadcrumb--sm',
      md: 'tx-breadcrumb--md',
      lg: 'tx-breadcrumb--lg',
    },
  },
  defaultVariants: { size: 'md' },
});

export function breadcrumbListClass(input?: { class?: ClassValue }): string {
  return cx('tx-breadcrumb__list', input?.class);
}

export function breadcrumbItemClass(input?: { class?: ClassValue }): string {
  return cx('tx-breadcrumb__item', input?.class);
}

export function breadcrumbLinkClass(input?: { class?: ClassValue; current?: boolean }): string {
  return cx('tx-breadcrumb__link', input?.current && 'tx-breadcrumb__link--current', input?.class);
}

export function breadcrumbSeparatorClass(input?: { class?: ClassValue }): string {
  return cx('tx-breadcrumb__separator', input?.class);
}

export function breadcrumbEllipsisClass(input?: { class?: ClassValue }): string {
  return cx('tx-breadcrumb__ellipsis', input?.class);
}

export const paginationClass = variants({
  base: 'tx-pagination',
  variants: {
    size: {
      sm: 'tx-pagination--sm',
      md: 'tx-pagination--md',
      lg: 'tx-pagination--lg',
    },
    variant: {
      outline: 'tx-pagination--outline',
      soft: 'tx-pagination--soft',
    },
  },
  defaultVariants: { size: 'md', variant: 'outline' },
});

export type PaginationVariant = 'outline' | 'soft';
export const PAGINATION_VARIANTS = [
  'outline',
  'soft',
] as const satisfies readonly PaginationVariant[];

export function paginationListClass(input?: { class?: ClassValue }): string {
  return cx('tx-pagination__list', input?.class);
}

export function paginationItemClass(input?: { class?: ClassValue }): string {
  return cx('tx-pagination__item', input?.class);
}

export function paginationButtonClass(input?: { class?: ClassValue; active?: boolean }): string {
  return cx(
    'tx-pagination__button',
    input?.active && 'tx-pagination__button--active',
    input?.class
  );
}

export function paginationEllipsisClass(input?: { class?: ClassValue }): string {
  return cx('tx-pagination__ellipsis', input?.class);
}

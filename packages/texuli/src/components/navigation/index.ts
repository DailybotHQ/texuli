/**
 * Styled NavigationMenu, Breadcrumb and Pagination on the token contract.
 */
import NavigationMenuContent from './NavigationMenuContent.svelte';
import NavigationMenuIndicator from './NavigationMenuIndicator.svelte';
import NavigationMenuItem from './NavigationMenuItem.svelte';
import NavigationMenuLink from './NavigationMenuLink.svelte';
import NavigationMenuList from './NavigationMenuList.svelte';
import NavigationMenuRoot from './NavigationMenuRoot.svelte';
import NavigationMenuTrigger from './NavigationMenuTrigger.svelte';
import NavigationMenuViewport from './NavigationMenuViewport.svelte';
import PaginationEllipsis from './PaginationEllipsis.svelte';
import PaginationNext from './PaginationNext.svelte';
import PaginationPage from './PaginationPage.svelte';
import PaginationPrevious from './PaginationPrevious.svelte';
import PaginationRoot from './PaginationRoot.svelte';

export const NavigationMenu: {
  Root: typeof NavigationMenuRoot;
  List: typeof NavigationMenuList;
  Item: typeof NavigationMenuItem;
  Trigger: typeof NavigationMenuTrigger;
  Content: typeof NavigationMenuContent;
  Link: typeof NavigationMenuLink;
  Viewport: typeof NavigationMenuViewport;
  Indicator: typeof NavigationMenuIndicator;
} = {
  Root: NavigationMenuRoot,
  List: NavigationMenuList,
  Item: NavigationMenuItem,
  Trigger: NavigationMenuTrigger,
  Content: NavigationMenuContent,
  Link: NavigationMenuLink,
  Viewport: NavigationMenuViewport,
  Indicator: NavigationMenuIndicator,
};

export const Pagination: {
  Root: typeof PaginationRoot;
  Page: typeof PaginationPage;
  PreviousButton: typeof PaginationPrevious;
  NextButton: typeof PaginationNext;
  Ellipsis: typeof PaginationEllipsis;
} = {
  Root: PaginationRoot,
  Page: PaginationPage,
  PreviousButton: PaginationPrevious,
  NextButton: PaginationNext,
  Ellipsis: PaginationEllipsis,
};

export { default as Breadcrumb } from './Breadcrumb.svelte';
export { default as NavigationMenuContent } from './NavigationMenuContent.svelte';
export { default as NavigationMenuIndicator } from './NavigationMenuIndicator.svelte';
export { default as NavigationMenuItem } from './NavigationMenuItem.svelte';
export { default as NavigationMenuLink } from './NavigationMenuLink.svelte';
export { default as NavigationMenuList } from './NavigationMenuList.svelte';
export { default as NavigationMenuRoot } from './NavigationMenuRoot.svelte';
export { default as NavigationMenuTrigger } from './NavigationMenuTrigger.svelte';
export { default as NavigationMenuViewport } from './NavigationMenuViewport.svelte';
export { default as PaginationEllipsis } from './PaginationEllipsis.svelte';
export { default as PaginationNext } from './PaginationNext.svelte';
export { default as PaginationPage } from './PaginationPage.svelte';
export { default as PaginationPrevious } from './PaginationPrevious.svelte';
export { default as PaginationRoot } from './PaginationRoot.svelte';
export { getStablePageTokens, stablePageSlots } from './pagination-tokens.ts';
export type { BreadcrumbItem } from './types.ts';

export {
  breadcrumbClass,
  breadcrumbEllipsisClass,
  breadcrumbItemClass,
  breadcrumbLinkClass,
  breadcrumbListClass,
  breadcrumbSeparatorClass,
  NAV_SIZES,
  type NavSize,
  navigationMenuClass,
  navigationMenuContentClass,
  navigationMenuIndicatorClass,
  navigationMenuItemClass,
  navigationMenuLinkClass,
  navigationMenuListClass,
  navigationMenuTriggerClass,
  navigationMenuViewportClass,
  PAGINATION_VARIANTS,
  type PaginationVariant,
  paginationButtonClass,
  paginationClass,
  paginationEllipsisClass,
  paginationItemClass,
  paginationListClass,
} from './variants.ts';

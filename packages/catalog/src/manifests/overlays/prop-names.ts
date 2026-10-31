/**
 * Canonical public prop names for overlay and navigation components in `texuli`.
 * Tests assert these equal catalog schema `props[].name` lists.
 * Keep in sync with Svelte `$props()` surfaces. Texuli-authored props only.
 */

export const dialogPropNames = [
  'open',
  'title',
  'description',
  'size',
  'trigger',
  'footer',
  'children',
  'hideClose',
  'closeLabel',
  'onOpenChange',
  'class',
] as const;

export const alertDialogPropNames = [
  'open',
  'title',
  'description',
  'confirmLabel',
  'cancelLabel',
  'destructive',
  'onConfirm',
  'onCancel',
  'trigger',
  'children',
  'class',
  'errorFallback',
  'onOpenChange',
] as const;

export const dropdownMenuPropNames = ['open', 'class', 'children'] as const;

export const dropdownMenuTriggerPropNames = ['size', 'variant', 'class', 'children'] as const;

export const dropdownMenuContentPropNames = [
  'size',
  'variant',
  'class',
  'children',
  'side',
  'align',
  'sideOffset',
] as const;

export const dropdownMenuItemPropNames = [
  'disabled',
  'textValue',
  'onSelect',
  'closeOnSelect',
  'icon',
  'shortcut',
  'inset',
  'class',
  'children',
] as const;

export const contextMenuPropNames = ['open', 'class', 'children'] as const;

export const contextMenuTriggerPropNames = ['class', 'children', 'disabled'] as const;

export const menubarPropNames = ['value', 'class', 'children', 'loop', 'dir'] as const;

export const menubarTriggerPropNames = [
  'size',
  'variant',
  'class',
  'children',
  'disabled',
] as const;

export const popoverPropNames = ['open', 'onOpenChange', 'children'] as const;

export const popoverContentPropNames = [
  'variant',
  'size',
  'arrow',
  'class',
  'children',
  'side',
  'align',
  'sideOffset',
  'initialFocus',
] as const;

export const hoverCardPropNames = ['open', 'children'] as const;

export const hoverCardContentPropNames = ['variant', 'size', 'arrow', 'class', 'children'] as const;

export const sheetContentPropNames = [
  'size',
  'side',
  'modal',
  'dismissOutside',
  'closeOnEscape',
  'class',
  'children',
] as const;

export const drawerContentPropNames = [
  'size',
  'side',
  'dismissOutside',
  'closeOnEscape',
  'class',
  'children',
] as const;

export const detailPanelContentPropNames = [
  'size',
  'side',
  'dismissOutside',
  'closeOnEscape',
  'class',
  'children',
] as const;

export const responsiveModalContentPropNames = ['size', 'side', 'class', 'children'] as const;

export const tooltipPropNames = [
  'content',
  'children',
  'shortcut',
  'side',
  'align',
  'sideOffset',
  'delayDuration',
  'disabled',
  'open',
  'class',
] as const;

export const toasterPropNames = [
  'label',
  'position',
  'offset',
  'store',
  'dismissLabel',
  'class',
] as const;

export const commandPalettePropNames = [
  'open',
  'onOpenChange',
  'search',
  'onSelect',
  'recentItems',
  'debounceMs',
  'placeholder',
  'shortcut',
  'recentLabel',
  'title',
  'searchLabel',
  'description',
  'emptyLabel',
  'recentEmptyLabel',
  'loadingLabel',
  'errorLabel',
  'size',
  'variant',
  'class',
] as const;

export const navigationMenuPropNames = [
  'value',
  'orientation',
  'dir',
  'delayDuration',
  'onValueChange',
  'class',
  'children',
] as const;

export const breadcrumbPropNames = [
  'items',
  'label',
  'size',
  'separatorLabel',
  'separator',
  'maxItems',
  'hrefTrust',
  'class',
] as const;

export const paginationPropNames = [
  'page',
  'pageCount',
  'size',
  'variant',
  'onPageChange',
  'class',
  'children',
  'label',
] as const;

export const sidebarPropNames = [
  'items',
  'sections',
  'collapsed',
  'collapsible',
  'drawer',
  'variant',
  'header',
  'footer',
  'itemIcon',
  'label',
  'collapseLabel',
  'expandLabel',
  'hrefTrust',
  'class',
] as const;

export const appNavPropNames = [
  'items',
  'sections',
  'collapsed',
  'collapsible',
  'variant',
  'header',
  'footer',
  'itemIcon',
  'children',
  'topBar',
  'label',
  'menuLabel',
  'drawerTitle',
  'hrefTrust',
  'mobileOpen',
  'class',
] as const;

/** Closed map of overlay/navigation component id → prop name list. */
export const OVERLAYS_PROP_NAMES = {
  dialog: dialogPropNames,
  'alert-dialog': alertDialogPropNames,
  'dropdown-menu': dropdownMenuPropNames,
  'dropdown-menu-trigger': dropdownMenuTriggerPropNames,
  'dropdown-menu-content': dropdownMenuContentPropNames,
  'dropdown-menu-item': dropdownMenuItemPropNames,
  'context-menu': contextMenuPropNames,
  'context-menu-trigger': contextMenuTriggerPropNames,
  menubar: menubarPropNames,
  'menubar-trigger': menubarTriggerPropNames,
  popover: popoverPropNames,
  'popover-content': popoverContentPropNames,
  'hover-card': hoverCardPropNames,
  'hover-card-content': hoverCardContentPropNames,
  sheet: sheetContentPropNames,
  drawer: drawerContentPropNames,
  'detail-panel': detailPanelContentPropNames,
  'responsive-modal': responsiveModalContentPropNames,
  tooltip: tooltipPropNames,
  toaster: toasterPropNames,
  'command-palette': commandPalettePropNames,
  'navigation-menu': navigationMenuPropNames,
  breadcrumb: breadcrumbPropNames,
  pagination: paginationPropNames,
  sidebar: sidebarPropNames,
  'app-nav': appNavPropNames,
} as const satisfies Record<string, readonly string[]>;

export type OverlaysManifestId = keyof typeof OVERLAYS_PROP_NAMES;

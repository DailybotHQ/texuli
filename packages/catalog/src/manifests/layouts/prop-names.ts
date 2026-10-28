/**
 * Canonical public prop names for layout and shell components in `texuli`.
 * Tests assert these equal catalog schema `props[].name` lists.
 * Keep in sync with Svelte `$props()` surfaces and LayoutProps.
 */

/** Shared LayoutHost layout props (lazy layouts under the host). */
export const hostLayoutPropNames = [
  'mountScreen',
  'nav',
  'path',
  'options',
  'storageKey',
  'aside',
  'class',
] as const;

export const layoutHostPropNames = [
  'layout',
  'children',
  'nav',
  'path',
  'options',
  'storageKey',
  'aside',
  'dir',
  'loadingLabel',
  'class',
] as const;

export const layoutChromePropNames = [
  'part',
  'nav',
  'mainId',
  'compact',
  'hrefTrust',
  'skipLabel',
  'class',
] as const;

export const layoutDrawerPropNames = ['open', 'label', 'closeLabel', 'children'] as const;

export const screenOutletPropNames = ['children', 'onready'] as const;

export const navIconPropNames = ['icon', 'class', 'label'] as const;

export const sidebarLayoutPropNames = [
  ...hostLayoutPropNames,
  'skipLabel',
  'menuLabel',
  'closeLabel',
] as const;

export const topNavLayoutPropNames = [
  ...hostLayoutPropNames,
  'skipLabel',
  'menuLabel',
  'closeLabel',
] as const;

export const dualSidebarLayoutPropNames = [
  ...hostLayoutPropNames,
  'skipLabel',
  'menuLabel',
  'closeLabel',
] as const;

export const splitViewPropNames = [
  'list',
  'detail',
  'empty',
  'listLabel',
  'detailLabel',
  'detailActive',
  'class',
] as const;

export const dashboardGridLayoutPropNames = [...hostLayoutPropNames, 'hrefTrust'] as const;

export const analyticsGridPropNames = [
  'columns',
  'minItem',
  'gap',
  'dense',
  'label',
  'children',
  'class',
] as const;

export const contentLayoutPropNames = [
  'kind',
  'mountScreen',
  'nav',
  'path',
  'options',
  'storageKey',
  'aside',
  'class',
] as const;

export const docsLayoutPropNames = [...hostLayoutPropNames] as const;
export const blogLayoutPropNames = [...hostLayoutPropNames] as const;
export const editorialLayoutPropNames = [...hostLayoutPropNames] as const;

export const marketingLayoutPropNames = [
  'mountScreen',
  'nav',
  'path',
  'options',
  'storageKey',
  'aside',
  'brand',
  'navigation',
  'actions',
  'hero',
  'sections',
  'footer',
  'navigationLabel',
  'heroLabel',
  'contentLabel',
  'class',
] as const;

export const landingLayoutPropNames = [
  'brand',
  'navigation',
  'actions',
  'hero',
  'sections',
  'footer',
  'class',
] as const;

export const pricingLayoutPropNames = [
  'title',
  'description',
  'plans',
  'footnote',
  'class',
  'children',
] as const;

export const authSplitLayoutPropNames = [
  'form',
  'mountScreen',
  'brand',
  'panel',
  'brandTitle',
  'brandDescription',
  'brandEyebrow',
  'formLabel',
  'panelLabel',
  'class',
] as const;

export const wizardLayoutPropNames = [
  'steps',
  'content',
  'mountScreen',
  'current',
  'title',
  'description',
  'canAdvance',
  'validate',
  'onFinish',
  'onStepChange',
  'backLabel',
  'nextLabel',
  'finishLabel',
  'secondaryActions',
  'brand',
  'class',
] as const;

export const settingsLayoutPropNames = [
  'title',
  'description',
  'sections',
  'active',
  'onSelect',
  'startWithList',
  'children',
  'mountScreen',
  'navLabel',
  'backLabel',
  'class',
] as const;

/** Abstract content layouts agents may emit (Tier U via CONTENT_LAYOUT_IDS). */
export const cardLayoutPropNames = ['title', 'children', 'class'] as const;
export const pageLayoutPropNames = ['title', 'description', 'children', 'class'] as const;
export const docLayoutPropNames = ['title', 'toc', 'children', 'class'] as const;
export const deckLayoutPropNames = [
  'title',
  'description',
  'locale',
  'aspect',
  'themeRef',
  'masters',
  'settings',
  'slides',
  'transition',
  'motion',
  'navigation',
  'outline',
  'children',
  'class',
] as const;
export const deckSlidePropNames = [
  'slideId',
  'title',
  'notes',
  'master',
  'layout',
  'transition',
  'themeRef',
  'background',
  'steps',
  'props',
  'component',
  'children',
  'class',
] as const;
export const gridLayoutPropNames = ['columns', 'gap', 'children', 'class'] as const;

export const LAYOUTS_PROP_NAMES = {
  'layout-host': layoutHostPropNames,
  'layout-chrome': layoutChromePropNames,
  'layout-drawer': layoutDrawerPropNames,
  'screen-outlet': screenOutletPropNames,
  'nav-icon': navIconPropNames,
  'layout-sidebar': sidebarLayoutPropNames,
  'layout-top-nav': topNavLayoutPropNames,
  'layout-dual-sidebar': dualSidebarLayoutPropNames,
  'split-view': splitViewPropNames,
  'layout-dashboard-grid': dashboardGridLayoutPropNames,
  'analytics-grid': analyticsGridPropNames,
  'content-layout': contentLayoutPropNames,
  'layout-docs': docsLayoutPropNames,
  'layout-blog': blogLayoutPropNames,
  'layout-editorial': editorialLayoutPropNames,
  'layout-marketing': marketingLayoutPropNames,
  'layout-landing': landingLayoutPropNames,
  'layout-pricing': pricingLayoutPropNames,
  'layout-auth-split': authSplitLayoutPropNames,
  'layout-wizard': wizardLayoutPropNames,
  'layout-settings': settingsLayoutPropNames,
  // Content composition layouts (Tier U: layout-card → card, etc.)
  'layout-card': cardLayoutPropNames,
  'layout-page': pageLayoutPropNames,
  'layout-doc': docLayoutPropNames,
  'layout-deck': deckLayoutPropNames,
  'deck-slide': deckSlidePropNames,
  'layout-grid': gridLayoutPropNames,
} as const;

export type LayoutsManifestId = keyof typeof LAYOUTS_PROP_NAMES;

/**
 * Canonical public prop names for each display/feedback component.
 * Tests assert these equal the catalog schema `props[].name` lists.
 * Keep in sync with the Svelte `Props` / `$props()` surfaces in `texuli`.
 */

export const cardPropNames = [
  'variant',
  'href',
  'hrefTrust',
  'linkLabel',
  'actions',
  'class',
] as const;

export const badgePropNames = ['variant', 'label', 'class', 'children'] as const;

export const tagPropNames = [
  'label',
  'variant',
  'removeLabel',
  'onRemove',
  'disabled',
  'class',
] as const;

export const chipPropNames = ['label', 'variant', 'selected', 'disabled', 'type', 'class'] as const;

export const tablePropNames = [
  'variant',
  'density',
  'stack',
  'stickyHeader',
  'maxBlockSize',
  'label',
  'busy',
  'wrapperClass',
  'class',
] as const;

export const alertPropNames = [
  'tone',
  'title',
  'text',
  'hideIcon',
  'icon',
  'actionLabel',
  'actionHref',
  'onAction',
  'dismissible',
  'dismissLabel',
  'onDismiss',
  'class',
] as const;

/** Callout and Banner share AlertSurface props without layout. */
export const calloutPropNames = alertPropNames;
export const bannerPropNames = alertPropNames;

export const statPropNames = [
  'label',
  'value',
  'delta',
  'trend',
  'positive',
  'hint',
  'icon',
  'sparkline',
  'variant',
  'class',
] as const;

export const kpiPropNames = [
  'label',
  'value',
  'unit',
  'currency',
  'previous',
  'comparisonLabel',
  'positive',
  'sparkline',
  'href',
  'hrefTrust',
  'loading',
  'empty',
  'variant',
  'class',
] as const;

export const emptyStatePropNames = [
  'title',
  'description',
  'illustration',
  'action',
  'size',
  'class',
] as const;

export const errorStatePropNames = [
  'title',
  'message',
  'onRetry',
  'retryLabel',
  'action',
  'class',
] as const;

export const stepperPropNames = [
  'steps',
  'current',
  'completed',
  'orientation',
  'onStepClick',
  'label',
  'class',
] as const;

export const timelinePropNames = [
  'items',
  'orientation',
  'label',
  'messages',
  'hrefTrust',
  'item',
  'class',
] as const;

export const kbdPropNames = ['label', 'class', 'children'] as const;

/** `texuli/avatar` AvatarGroupGrid (D-G-024); new in 0.14.0 (spec 0.12.0). */
export const avatarGroupGridPropNames = [
  'items',
  'size',
  'label',
  'overflowLabel',
  'class',
] as const;

export const codePropNames = ['value', 'variant', 'language', 'class'] as const;

/**
 * The inline text node (audit G03) has no Svelte component: the host paints
 * `text` as one escaped text node inside its parent's slot.
 */
export const inlineTextPropNames = ['text'] as const;

/** `texuli/typography` (ADR-032): titles and section headings, `<h1>`…`<h6>`. */
export const headingPropNames = [
  'level',
  'size',
  'tone',
  'truncate',
  'label',
  'class',
  'children',
] as const;

/** `texuli/typography`: body copy, labels and small print; never a heading. */
export const textPropNames = [
  'as',
  'size',
  'tone',
  'weight',
  'truncate',
  'lineClamp',
  'align',
  'mono',
  'tabular',
  'transform',
  'tracking',
  'for',
  'label',
  'class',
  'children',
] as const;

/** `texuli/typography`: long-form reading rhythm. */
export const prosePropNames = ['as', 'size', 'class', 'children'] as const;

/** `texuli/typography`: a token-driven panel. */
export const boxPropNames = [
  'as',
  'padding',
  'radius',
  'border',
  'elevation',
  'surface',
  'class',
  'children',
] as const;

/** `texuli/tabs-accordion`: a tab list with panels. */
export const tabsPropNames = [
  'items',
  'value',
  'onValueChange',
  'label',
  'variant',
  'orientation',
  'activationMode',
  'loop',
  'disabled',
  'class',
  'content',
] as const;

/** `texuli/tabs-accordion`: stacked disclosure sections. */
export const accordionPropNames = [
  'items',
  'type',
  'value',
  'onValueChange',
  'collapsible',
  'headingLevel',
  'variant',
  'disabled',
  'class',
  'content',
] as const;

export const iconPropNames = ['icon', 'size', 'tone', 'label', 'class'] as const;

export const avatarPropNames = [
  'name',
  'src',
  'srcTrust',
  'srcset',
  'sizes',
  'size',
  'tone',
  'shape',
  'status',
  'decorative',
  'delayMs',
  'initials',
  'class',
] as const;

export const skeletonPropNames = ['size', 'circle', 'class'] as const;

export const spinnerPropNames = ['label', 'size', 'tone', 'class'] as const;

export const progressPropNames = [
  'value',
  'max',
  'min',
  'label',
  'ariaLabel',
  'showValue',
  'tone',
  'size',
  'shape',
  'loadingLabel',
  'class',
] as const;

export const carouselPropNames = [
  'items',
  'index',
  'label',
  'showControls',
  'showDots',
  'controls',
  'loop',
  'class',
] as const;

export const separatorPropNames = ['orientation', 'decorative', 'variant', 'class'] as const;

export const listItemPropNames = [
  'title',
  'description',
  'meta',
  'icon',
  'href',
  'hrefTrust',
  'current',
  'disabled',
  'class',
] as const;

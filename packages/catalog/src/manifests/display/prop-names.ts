/**
 * Canonical public prop names for each display/feedback component.
 * Tests assert these equal the catalog schema `props[].name` lists.
 * Keep in sync with the Svelte `Props` / `$props()` surfaces in `texuli`.
 */

export const cardPropNames = ['variant', 'href', 'hrefTrust', 'linkLabel', 'class'] as const;

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

export const codePropNames = ['value', 'variant', 'language', 'class'] as const;

/**
 * The inline text node (audit G03) has no Svelte component: the host paints
 * `text` as one escaped text node inside its parent's slot.
 */
export const inlineTextPropNames = ['text'] as const;

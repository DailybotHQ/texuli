/** Text direction used by Texuli's direction-aware behavior. */
export type TextDirection = 'ltr' | 'rtl';

/** Logical inline side, independent of text direction. */
export type InlineSide = 'start' | 'end';

/**
 * Resolves the nearest valid `dir="ltr"` or `dir="rtl"` attribute for an
 * element, including its document root. Invalid and empty values inherit.
 * `dir="auto"` uses the browser's computed direction when available; on the
 * server, or when computation is unavailable, it inherits. `fallback` is
 * returned when no explicit direction is found.
 *
 * This reads only the element and its owner document; it does not consult
 * global `document` or `window` values.
 */
export function directionOf(
  target: Element | Document,
  fallback: TextDirection = 'ltr'
): TextDirection {
  let element: Element | null =
    target.nodeType === 9 ? (target as Document).documentElement : (target as Element);

  while (element) {
    const value = element.getAttribute('dir')?.trim().toLowerCase();
    if (value === 'ltr' || value === 'rtl') return value;
    if (value === 'auto') {
      const computed = element.ownerDocument.defaultView?.getComputedStyle(element).direction;
      if (computed === 'ltr' || computed === 'rtl') return computed;
    }

    const parent: Element | null = element.parentElement;
    if (parent) {
      element = parent;
      continue;
    }

    // Directionality crosses a shadow boundary through the host.
    const root = element.getRootNode();
    element = root.nodeType === 11 ? (root as ShadowRoot).host : null;
  }

  return fallback;
}

/**
 * Maps an inline logical side to its physical horizontal side. Block sides
 * and vertical writing modes are intentionally outside this helper's scope.
 */
export function inlineSideToPhysical(side: InlineSide, direction: TextDirection): 'left' | 'right' {
  if (side === 'start') return direction === 'rtl' ? 'right' : 'left';
  return direction === 'rtl' ? 'left' : 'right';
}

/** Creates an explicit-locale collator for repeated comparisons. */
export function createCollator(
  locale: string,
  options: Intl.CollatorOptions = { numeric: true, sensitivity: 'base' }
): Intl.Collator {
  return new Intl.Collator(locale, options);
}

/** Compares strings using an explicit locale and stable numeric, base defaults. */
export function compareLocale(
  left: string,
  right: string,
  locale: string,
  options?: Intl.CollatorOptions
): number {
  return createCollator(locale, options).compare(left, right);
}

const ENGLISH_MESSAGES = {
  close: 'Close',
  next: 'Next',
  previous: 'Previous',
  loading: 'Loading…',
  open: 'Open',
  dismiss: 'Dismiss',
  cancel: 'Cancel',
  apply: 'Apply',
  search: 'Search',
  clear: 'Clear',
  noResults: 'No results found',
  select: 'Select',
  selected: 'Selected',
  remove: 'Remove',
  edit: 'Edit',
  save: 'Save',
  delete: 'Delete',
  more: 'More',
  less: 'Less',
  expand: 'Expand',
  collapse: 'Collapse',
  first: 'First',
  last: 'Last',
  page: 'Page',
  of: 'of',
  menu: 'Menu',
  options: 'Options',
  required: 'Required',
  optional: 'Optional',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  copy: 'Copy',
  copied: 'Copied',
  retry: 'Retry',
} as const;

/** English default labels that every built-in Texuli control can reference. */
export type TexuliMessages = { [Key in keyof typeof ENGLISH_MESSAGES]: string };

/**
 * English defaults for built-in labels. Pass these keys to `resolveMessages`
 * with translated overrides; an omitted or undefined label keeps its default.
 */
export const DEFAULT_MESSAGES: Readonly<TexuliMessages> = Object.freeze(ENGLISH_MESSAGES);

/** Resolves a partial translation against the complete English label set. */
export function resolveMessages(overrides: Partial<TexuliMessages> = {}): TexuliMessages {
  const keys = Object.keys(DEFAULT_MESSAGES) as (keyof TexuliMessages)[];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      typeof overrides[key] === 'string' ? overrides[key] : DEFAULT_MESSAGES[key],
    ])
  ) as TexuliMessages;
}

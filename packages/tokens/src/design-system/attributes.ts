/**
 * The runtime vocabulary of a compiled design system (ADR-023), in a module
 * of its own so `design-system/apply` reads it without the guarantee checks
 * or the color engine.
 */

/** The `data-tx-*` attributes a compiled design system may carry (ADR-023). */
export const DESIGN_SYSTEM_ATTRIBUTES = [
  'data-tx-ds',
  'data-tx-ds-version',
  'data-tx-ds-variant',
  'data-tx-surface',
  'data-tx-elevation',
  'data-tx-focus-ring-style',
  'data-tx-icon-style',
] as const;

export type DesignSystemAttribute = (typeof DESIGN_SYSTEM_ATTRIBUTES)[number];

export type DesignSystemMode = 'light' | 'dark';

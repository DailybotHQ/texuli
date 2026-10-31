/**
 * `texuli/design-system`: `DesignSystemProvider` (ADR-023), a scope element
 * that applies a compiled design system (`@texuli/tokens/design-system/apply`)
 * and provides its component defaults (`texuli/defaults`). Portals opened
 * inside follow the scope. A subpath of its own: the `texuli` root never
 * imports it, so apps without a design system pay nothing.
 */
export { default as DesignSystemProvider } from './DesignSystemProvider.svelte';

/**
 * The attributes the provider renders in markup, so a server-rendered page
 * matches `designSystemStyle`'s selector before hydration. Equal to
 * `DESIGN_SYSTEM_ATTRIBUTES` (a test holds them together); a copy keeps the
 * compiler's guarantee module out of this subpath.
 */
export const PROVIDER_ATTRIBUTES = [
  'data-tx-ds',
  'data-tx-ds-version',
  'data-tx-ds-variant',
  'data-tx-surface',
  'data-tx-elevation',
  'data-tx-focus-ring-style',
  'data-tx-icon-style',
] as const;

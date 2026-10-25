/**
 * `@texuli/tokens/aa-gate/components` — WCAG AA pair matrix for component chrome
 * (Button, Badge, Toggle, Alert, Callout, Toast, layout nav, map markers).
 * Import from here in tests and theme tooling; keep `@texuli/tokens/aa-gate`
 * free of the pair table.
 */

export {
  COMPONENT_CONTRAST_PAIRS,
  type ComponentContrastKind,
  type ComponentContrastPair,
} from './component-pairs.ts';

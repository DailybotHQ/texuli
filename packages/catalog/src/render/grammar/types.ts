import type { RenderNode } from '../renderer/types.ts';

/**
 * Composition grammar roles for sink-free catalog trees.
 * Used after {@link renderCatalogTree} to enforce accessible structure.
 */

/** Structural role a catalog component plays in a composition. */
export type GrammarRole =
  | 'static'
  | 'heading'
  | 'interactive'
  | 'primary-action'
  | 'landmark'
  | 'container';

/** ARIA landmark kind (unique within a tree unless region). */
export type GrammarLandmark =
  | 'main'
  | 'navigation'
  | 'banner'
  | 'contentinfo'
  | 'complementary'
  | 'search'
  | 'form'
  | 'region';

/**
 * Per-component metadata the grammar needs. Hosts supply this from the built
 * catalog or a test double — the grammar never loads Svelte.
 */
export interface GrammarComponentMeta {
  id: string;
  role?: GrammarRole;
  /**
   * Prop that holds a heading level 1–6 (e.g. `headingLevel`, `level`).
   * Used when `role` is `heading`.
   */
  headingLevelProp?: string;
  /** Fixed level when the component always renders the same rank. */
  fixedHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Prop that holds a content block (e.g. `block` on `blocks-text`). The node
   * is a heading only when that block's `type` is `heading`, at the block's
   * own `level`.
   */
  headingBlockProp?: string;
  /**
   * The node renders a non-empty `title` prop as a heading: at this fixed
   * rank, or `nested` for one rank below the nearest titled frame or card
   * around it. A titled `nested` or rank-1 node also sets that rank for the
   * headings nested inside it.
   */
  titleHeading?: 1 | 2 | 3 | 4 | 5 | 6 | 'nested';
  /** Landmark kind when `role` is `landmark` (or container that is a landmark). */
  landmark?: GrammarLandmark;
  /**
   * Prop that marks a primary action when its value is in `primaryValues`
   * (default: truthy `primary` or `variant === 'default'` / `'primary'`).
   */
  primaryProp?: string;
  primaryValues?: readonly string[];
  /**
   * Props that reverse or break DOM=visual order (absolute/fixed, CSS order).
   * Presence of a non-default value yields a `visual-order` issue.
   */
  orderBreakingProps?: readonly string[];
  /**
   * Inherit every field this row does not set from another catalog id,
   * resolved first against the list, then against the built-in defaults.
   */
  deriveFrom?: string;
  /** Role overrides applied when the node sits inside one of `inside`. */
  nestedRoles?: readonly GrammarNestedRole[];
}

/** A role override for a node nested inside one of the given component ids. */
export interface GrammarNestedRole {
  /** Enclosing component ids that trigger the override (any ancestor). */
  inside: readonly string[];
  /** The role applied instead of the component's own. */
  role: GrammarRole;
}

/** Lookup for grammar roles by component id. */
export type GrammarRoleCatalog = {
  get(id: string): GrammarComponentMeta | undefined;
};

export type GrammarIssueCode =
  | 'heading-skip'
  | 'heading-multiple-h1'
  | 'heading-level-invalid'
  | 'interactive-nesting'
  | 'primary-action-multiple'
  | 'landmark-duplicate'
  | 'landmark-multiple-main'
  | 'visual-order'
  | 'unknown-role';

export interface GrammarIssue {
  code: GrammarIssueCode;
  /** Path from the root, e.g. `0.children.1`. */
  path: string;
  message: string;
  id?: string;
}

export type GrammarMode = 'report' | 'repair';

export interface GrammarOptions {
  roles: GrammarRoleCatalog;
  /**
   * `report` — diagnostics only, tree unchanged.
   * `repair` — return a repaired tree plus diagnostics for what changed.
   * Default `report`.
   */
  mode?: GrammarMode;
  /**
   * Starting outline level before the first heading (document context).
   * Default 0 (next heading may be h1).
   */
  baseHeadingLevel?: number;
}

export interface GrammarResult {
  /** Roots after optional repair (same reference as input when `report`). */
  roots: readonly RenderNode[];
  issues: readonly GrammarIssue[];
  /** True when every hard rule passed (repairs still list issues they fixed). */
  ok: boolean;
}
